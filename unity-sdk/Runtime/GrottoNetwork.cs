using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;

namespace Grotto.Networking
{
    /// <summary>
    /// Main interface for Grotto multiplayer services.
    /// Drop-in solution for hosting and joining game lobbies.
    /// </summary>
    public static class GrottoNetwork
    {
        private static string _serverUrl;
        private static string _serverId;
        private static string _apiKey;
        private static GrottoLobby _currentLobby;
        private static GrottoWebSocket _socket;
        private static bool _initialized;

        // Events
        public static event Action<GrottoLobby> OnLobbyCreated;
        public static event Action<GrottoLobby> OnJoinedLobby;
        public static event Action<GrottoPlayer> OnPlayerJoined;
        public static event Action<GrottoPlayer> OnPlayerLeft;
        public static event Action<string> OnJoinFailed;
        public static event Action OnDisconnected;
        public static event Action<string, byte[]> OnMessageReceived;

        /// <summary>
        /// Initialize with your Grotto server credentials.
        /// </summary>
        public static void Initialize(string serverId, string apiKey = null)
        {
            _serverId = serverId;
            _apiKey = apiKey;
            _initialized = true;
            Debug.Log($"[Grotto] Initialized with server: {serverId}");
        }

        /// <summary>
        /// Initialize with full server URL (for self-hosted).
        /// </summary>
        public static void Initialize(string serverUrl, string serverId, string apiKey)
        {
            _serverUrl = serverUrl.TrimEnd('/');
            _serverId = serverId;
            _apiKey = apiKey;
            _initialized = true;
            Debug.Log($"[Grotto] Initialized with custom server: {serverUrl}");
        }

        private static string GetServerUrl()
        {
            if (!string.IsNullOrEmpty(_serverUrl)) return _serverUrl;
            return $"https://relay.grotto.gg/{_serverId}";
        }

        /// <summary>
        /// Host a new game lobby.
        /// </summary>
        public static async Task<GrottoLobby> HostLobby(string lobbyName, int maxPlayers = 8, bool isPublic = true, string password = null)
        {
            EnsureInitialized();

            var request = new CreateLobbyRequest
            {
                name = lobbyName,
                maxPlayers = maxPlayers,
                isPublic = isPublic,
                password = password
            };

            var response = await PostAsync<CreateLobbyResponse>("/api/lobbies", request);

            if (!response.success)
            {
                Debug.LogError($"[Grotto] Failed to create lobby: {response.error}");
                return null;
            }

            _currentLobby = response.lobby;
            _currentLobby.isHost = true;

            // Connect to relay
            await ConnectToRelay(response.lobby.id, response.token, true);

            OnLobbyCreated?.Invoke(_currentLobby);
            return _currentLobby;
        }

        /// <summary>
        /// Join a lobby by code.
        /// </summary>
        public static async Task<GrottoLobby> JoinLobby(string lobbyCode, string password = null)
        {
            EnsureInitialized();

            var request = new JoinLobbyRequest
            {
                code = lobbyCode,
                password = password
            };

            var response = await PostAsync<JoinLobbyResponse>("/api/lobbies/join", request);

            if (!response.success)
            {
                Debug.LogError($"[Grotto] Failed to join lobby: {response.error}");
                OnJoinFailed?.Invoke(response.error);
                return null;
            }

            _currentLobby = response.lobby;
            _currentLobby.isHost = false;

            await ConnectToRelay(response.lobby.id, response.token, false);

            OnJoinedLobby?.Invoke(_currentLobby);
            return _currentLobby;
        }

        /// <summary>
        /// Join a lobby directly.
        /// </summary>
        public static async Task<GrottoLobby> JoinLobby(GrottoLobby lobby, string password = null)
        {
            return await JoinLobby(lobby.code, password);
        }

        /// <summary>
        /// Get list of public lobbies.
        /// </summary>
        public static async Task<List<GrottoLobby>> GetLobbies()
        {
            EnsureInitialized();

            var response = await GetAsync<GetLobbiesResponse>("/api/lobbies");

            if (!response.success)
            {
                Debug.LogError($"[Grotto] Failed to get lobbies: {response.error}");
                return new List<GrottoLobby>();
            }

            return response.lobbies ?? new List<GrottoLobby>();
        }

        /// <summary>
        /// Leave the current lobby.
        /// </summary>
        public static async Task LeaveLobby()
        {
            if (_currentLobby == null) return;

            _socket?.Disconnect();
            _socket = null;

            await PostAsync<BaseResponse>($"/api/lobbies/{_currentLobby.id}/leave", null);
            _currentLobby = null;

            OnDisconnected?.Invoke();
        }

        /// <summary>
        /// Send data to all players (host only) or to host (client).
        /// </summary>
        public static void Send(string channel, byte[] data)
        {
            _socket?.Send(channel, data);
        }

        /// <summary>
        /// Send data to a specific player (host only).
        /// </summary>
        public static void SendTo(string playerId, string channel, byte[] data)
        {
            _socket?.SendTo(playerId, channel, data);
        }

        /// <summary>
        /// Kick a player from the lobby (host only).
        /// </summary>
        public static async Task KickPlayer(string playerId)
        {
            if (_currentLobby == null || !_currentLobby.isHost) return;
            await PostAsync<BaseResponse>($"/api/lobbies/{_currentLobby.id}/kick/{playerId}", null);
        }

        /// <summary>
        /// Close the lobby (host only).
        /// </summary>
        public static async Task CloseLobby()
        {
            if (_currentLobby == null || !_currentLobby.isHost) return;
            await PostAsync<BaseResponse>($"/api/lobbies/{_currentLobby.id}/close", null);
            await LeaveLobby();
        }

        public static GrottoLobby CurrentLobby => _currentLobby;
        public static bool IsConnected => _socket?.IsConnected ?? false;
        public static bool IsHost => _currentLobby?.isHost ?? false;

        // Internal
        private static void EnsureInitialized()
        {
            if (!_initialized)
                throw new InvalidOperationException("GrottoNetwork not initialized. Call Initialize() first.");
        }

        private static async Task ConnectToRelay(string lobbyId, string token, bool isHost)
        {
            var wsUrl = GetServerUrl().Replace("https://", "wss://").Replace("http://", "ws://");
            wsUrl = $"{wsUrl}/ws?lobby={lobbyId}&token={token}";

            _socket = new GrottoWebSocket();
            _socket.OnPlayerJoined += (p) => OnPlayerJoined?.Invoke(p);
            _socket.OnPlayerLeft += (p) => OnPlayerLeft?.Invoke(p);
            _socket.OnMessage += (ch, data) => OnMessageReceived?.Invoke(ch, data);
            _socket.OnDisconnected += () => OnDisconnected?.Invoke();

            await _socket.Connect(wsUrl);
        }

        private static async Task<T> GetAsync<T>(string endpoint) where T : BaseResponse, new()
        {
            var url = GetServerUrl() + endpoint;
            using var request = UnityWebRequest.Get(url);
            request.SetRequestHeader("X-Server-Id", _serverId);
            if (!string.IsNullOrEmpty(_apiKey))
                request.SetRequestHeader("X-Api-Key", _apiKey);

            var op = request.SendWebRequest();
            while (!op.isDone) await Task.Yield();

            if (request.result != UnityWebRequest.Result.Success)
            {
                return new T { success = false, error = request.error };
            }

            return JsonUtility.FromJson<T>(request.downloadHandler.text);
        }

        private static async Task<T> PostAsync<T>(string endpoint, object data) where T : BaseResponse, new()
        {
            var url = GetServerUrl() + endpoint;
            var json = data != null ? JsonUtility.ToJson(data) : "{}";

            using var request = new UnityWebRequest(url, "POST");
            request.uploadHandler = new UploadHandlerRaw(System.Text.Encoding.UTF8.GetBytes(json));
            request.downloadHandler = new DownloadHandlerBuffer();
            request.SetRequestHeader("Content-Type", "application/json");
            request.SetRequestHeader("X-Server-Id", _serverId);
            if (!string.IsNullOrEmpty(_apiKey))
                request.SetRequestHeader("X-Api-Key", _apiKey);

            var op = request.SendWebRequest();
            while (!op.isDone) await Task.Yield();

            if (request.result != UnityWebRequest.Result.Success)
            {
                return new T { success = false, error = request.error };
            }

            return JsonUtility.FromJson<T>(request.downloadHandler.text);
        }

        // Request/Response types
        [Serializable] private class BaseResponse { public bool success; public string error; }
        [Serializable] private class CreateLobbyRequest { public string name; public int maxPlayers; public bool isPublic; public string password; }
        [Serializable] private class CreateLobbyResponse : BaseResponse { public GrottoLobby lobby; public string token; }
        [Serializable] private class JoinLobbyRequest { public string code; public string password; }
        [Serializable] private class JoinLobbyResponse : BaseResponse { public GrottoLobby lobby; public string token; }
        [Serializable] private class GetLobbiesResponse : BaseResponse { public List<GrottoLobby> lobbies; }
    }
}

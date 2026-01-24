using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;

namespace Grotto.Networking
{
    /// <summary>
    /// WebSocket wrapper for relay communication.
    /// Uses native WebSocket on WebGL, NativeWebSocket package otherwise.
    /// </summary>
    public class GrottoWebSocket
    {
        public event Action<GrottoPlayer> OnPlayerJoined;
        public event Action<GrottoPlayer> OnPlayerLeft;
        public event Action<string, byte[]> OnMessage;
        public event Action OnDisconnected;

        private object _socket; // Platform-specific socket
        private bool _isConnected;
        private Queue<Action> _mainThreadQueue = new Queue<Action>();

        public bool IsConnected => _isConnected;

        public async Task Connect(string url)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            await ConnectWebGL(url);
#else
            await ConnectNative(url);
#endif
        }

        public void Disconnect()
        {
            _isConnected = false;
#if UNITY_WEBGL && !UNITY_EDITOR
            DisconnectWebGL();
#else
            DisconnectNative();
#endif
        }

        public void Send(string channel, byte[] data)
        {
            var msg = new RelayMessage { type = "broadcast", channel = channel, data = Convert.ToBase64String(data) };
            SendRaw(JsonUtility.ToJson(msg));
        }

        public void SendTo(string playerId, string channel, byte[] data)
        {
            var msg = new RelayMessage { type = "send", target = playerId, channel = channel, data = Convert.ToBase64String(data) };
            SendRaw(JsonUtility.ToJson(msg));
        }

        private void SendRaw(string json)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            SendWebGL(json);
#else
            SendNative(json);
#endif
        }

        private void HandleMessage(string json)
        {
            try
            {
                var msg = JsonUtility.FromJson<RelayMessage>(json);

                switch (msg.type)
                {
                    case "player_joined":
                        var joinedPlayer = JsonUtility.FromJson<GrottoPlayer>(msg.data);
                        QueueMainThread(() => OnPlayerJoined?.Invoke(joinedPlayer));
                        break;

                    case "player_left":
                        var leftPlayer = JsonUtility.FromJson<GrottoPlayer>(msg.data);
                        QueueMainThread(() => OnPlayerLeft?.Invoke(leftPlayer));
                        break;

                    case "message":
                        var data = Convert.FromBase64String(msg.data);
                        QueueMainThread(() => OnMessage?.Invoke(msg.channel, data));
                        break;

                    case "kicked":
                    case "closed":
                        QueueMainThread(() => OnDisconnected?.Invoke());
                        Disconnect();
                        break;
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"[Grotto] Failed to parse message: {e.Message}");
            }
        }

        private void QueueMainThread(Action action)
        {
            lock (_mainThreadQueue)
            {
                _mainThreadQueue.Enqueue(action);
            }
        }

        /// <summary>
        /// Call this from Update() to process messages on main thread.
        /// </summary>
        public void ProcessQueue()
        {
            lock (_mainThreadQueue)
            {
                while (_mainThreadQueue.Count > 0)
                {
                    _mainThreadQueue.Dequeue()?.Invoke();
                }
            }
        }

#if UNITY_WEBGL && !UNITY_EDITOR
        // WebGL implementation using JavaScript interop
        [System.Runtime.InteropServices.DllImport("__Internal")]
        private static extern void GrottoWS_Connect(string url, string id);
        [System.Runtime.InteropServices.DllImport("__Internal")]
        private static extern void GrottoWS_Send(string id, string data);
        [System.Runtime.InteropServices.DllImport("__Internal")]
        private static extern void GrottoWS_Close(string id);

        private string _wsId;

        private Task ConnectWebGL(string url)
        {
            _wsId = Guid.NewGuid().ToString();
            GrottoWS_Connect(url, _wsId);
            _isConnected = true;
            return Task.CompletedTask;
        }

        private void SendWebGL(string data) => GrottoWS_Send(_wsId, data);
        private void DisconnectWebGL() => GrottoWS_Close(_wsId);

        // Called from JavaScript
        public void OnWebGLMessage(string data) => HandleMessage(data);
        public void OnWebGLClose() { _isConnected = false; OnDisconnected?.Invoke(); }
#else
        // Native implementation using System.Net.WebSockets
        private System.Net.WebSockets.ClientWebSocket _nativeSocket;
        private System.Threading.CancellationTokenSource _cts;

        private async Task ConnectNative(string url)
        {
            _nativeSocket = new System.Net.WebSockets.ClientWebSocket();
            _cts = new System.Threading.CancellationTokenSource();

            await _nativeSocket.ConnectAsync(new Uri(url), _cts.Token);
            _isConnected = true;

            // Start receive loop
            _ = ReceiveLoop();
        }

        private async Task ReceiveLoop()
        {
            var buffer = new byte[8192];
            try
            {
                while (_isConnected && _nativeSocket.State == System.Net.WebSockets.WebSocketState.Open)
                {
                    var result = await _nativeSocket.ReceiveAsync(new ArraySegment<byte>(buffer), _cts.Token);

                    if (result.MessageType == System.Net.WebSockets.WebSocketMessageType.Close)
                    {
                        _isConnected = false;
                        QueueMainThread(() => OnDisconnected?.Invoke());
                        break;
                    }

                    if (result.MessageType == System.Net.WebSockets.WebSocketMessageType.Text)
                    {
                        var json = System.Text.Encoding.UTF8.GetString(buffer, 0, result.Count);
                        HandleMessage(json);
                    }
                }
            }
            catch (Exception e)
            {
                Debug.LogError($"[Grotto] WebSocket error: {e.Message}");
                _isConnected = false;
                QueueMainThread(() => OnDisconnected?.Invoke());
            }
        }

        private async void SendNative(string data)
        {
            if (_nativeSocket?.State != System.Net.WebSockets.WebSocketState.Open) return;
            var bytes = System.Text.Encoding.UTF8.GetBytes(data);
            await _nativeSocket.SendAsync(new ArraySegment<byte>(bytes), System.Net.WebSockets.WebSocketMessageType.Text, true, _cts.Token);
        }

        private void DisconnectNative()
        {
            _cts?.Cancel();
            _nativeSocket?.Dispose();
            _nativeSocket = null;
        }
#endif

        [Serializable]
        private class RelayMessage
        {
            public string type;
            public string channel;
            public string target;
            public string data;
        }
    }
}

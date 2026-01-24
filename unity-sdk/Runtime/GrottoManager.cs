using System;
using UnityEngine;

namespace Grotto.Networking
{
    /// <summary>
    /// Attach this to a GameObject to initialize Grotto networking.
    /// </summary>
    public class GrottoManager : MonoBehaviour
    {
        [Header("Server Configuration")]
        [Tooltip("Your Grotto Server ID (from panel)")]
        public string serverId;

        [Tooltip("Optional: API key for private servers")]
        public string apiKey;

        [Tooltip("Optional: Custom server URL for self-hosted")]
        public string customServerUrl;

        [Header("Player Settings")]
        [Tooltip("Display name for this player")]
        public string playerName = "Player";

        [Header("Settings")]
        [Tooltip("Keep connection alive across scenes")]
        public bool dontDestroyOnLoad = true;

        public static GrottoManager Instance { get; private set; }

        private GrottoWebSocket _socket;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;

            if (dontDestroyOnLoad)
                DontDestroyOnLoad(gameObject);

            Initialize();
        }

        private void Initialize()
        {
            if (string.IsNullOrEmpty(serverId))
            {
                Debug.LogError("[Grotto] Server ID not set! Configure it in the GrottoManager inspector.");
                return;
            }

            if (!string.IsNullOrEmpty(customServerUrl))
                GrottoNetwork.Initialize(customServerUrl, serverId, apiKey);
            else
                GrottoNetwork.Initialize(serverId, apiKey);
        }

        private void Update()
        {
            // Process WebSocket messages on main thread
            if (_socket != null)
                _socket.ProcessQueue();
        }

        private void OnDestroy()
        {
            if (Instance == this)
                Instance = null;
        }

        private void OnApplicationQuit()
        {
            // Clean disconnect
            _ = GrottoNetwork.LeaveLobby();
        }
    }
}

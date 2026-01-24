using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace Grotto.Networking.UI
{
    /// <summary>
    /// Ready-to-use lobby browser UI component.
    /// Requires TextMeshPro.
    /// </summary>
    public class GrottoLobbyBrowser : MonoBehaviour
    {
        [Header("UI References")]
        public Transform lobbyListContainer;
        public GameObject lobbyItemPrefab;
        public Button refreshButton;
        public Button hostButton;
        public TMP_InputField lobbyCodeInput;
        public Button joinByCodeButton;

        [Header("Host Dialog")]
        public GameObject hostDialog;
        public TMP_InputField lobbyNameInput;
        public TMP_InputField maxPlayersInput;
        public Toggle publicToggle;
        public TMP_InputField passwordInput;
        public Button confirmHostButton;
        public Button cancelHostButton;

        [Header("Settings")]
        public float autoRefreshInterval = 5f;
        public string gameSceneName = "Game";

        private List<GrottoLobby> _lobbies = new List<GrottoLobby>();
        private Coroutine _refreshCoroutine;

        private void Start()
        {
            SetupEventListeners();
            RefreshLobbies();

            if (autoRefreshInterval > 0)
                _refreshCoroutine = StartCoroutine(AutoRefresh());
        }

        private void OnDestroy()
        {
            if (_refreshCoroutine != null)
                StopCoroutine(_refreshCoroutine);
        }

        private void SetupEventListeners()
        {
            if (refreshButton) refreshButton.onClick.AddListener(RefreshLobbies);
            if (hostButton) hostButton.onClick.AddListener(ShowHostDialog);
            if (joinByCodeButton) joinByCodeButton.onClick.AddListener(JoinByCode);
            if (confirmHostButton) confirmHostButton.onClick.AddListener(ConfirmHost);
            if (cancelHostButton) cancelHostButton.onClick.AddListener(HideHostDialog);

            GrottoNetwork.OnLobbyCreated += OnLobbyCreated;
            GrottoNetwork.OnJoinedLobby += OnJoinedLobby;
            GrottoNetwork.OnJoinFailed += OnJoinFailed;
        }

        public async void RefreshLobbies()
        {
            _lobbies = await GrottoNetwork.GetLobbies();
            UpdateLobbyList();
        }

        private void UpdateLobbyList()
        {
            // Clear existing items
            foreach (Transform child in lobbyListContainer)
                Destroy(child.gameObject);

            if (_lobbies.Count == 0)
            {
                var emptyText = new GameObject("EmptyText").AddComponent<TextMeshProUGUI>();
                emptyText.text = "No lobbies available";
                emptyText.fontSize = 14;
                emptyText.alignment = TextAlignmentOptions.Center;
                emptyText.color = Color.gray;
                emptyText.transform.SetParent(lobbyListContainer, false);
                return;
            }

            foreach (var lobby in _lobbies)
            {
                var item = Instantiate(lobbyItemPrefab, lobbyListContainer);
                SetupLobbyItem(item, lobby);
            }
        }

        private void SetupLobbyItem(GameObject item, GrottoLobby lobby)
        {
            // Find UI elements
            var nameText = item.transform.Find("Name")?.GetComponent<TMP_Text>();
            var playersText = item.transform.Find("Players")?.GetComponent<TMP_Text>();
            var codeText = item.transform.Find("Code")?.GetComponent<TMP_Text>();
            var joinBtn = item.transform.Find("JoinButton")?.GetComponent<Button>();
            var lockIcon = item.transform.Find("LockIcon")?.gameObject;

            if (nameText) nameText.text = lobby.name;
            if (playersText) playersText.text = $"{lobby.playerCount}/{lobby.maxPlayers}";
            if (codeText) codeText.text = lobby.code;
            if (lockIcon) lockIcon.SetActive(lobby.hasPassword);

            if (joinBtn)
            {
                joinBtn.interactable = !lobby.IsFull;
                joinBtn.onClick.AddListener(() => JoinLobby(lobby));
            }
        }

        private async void JoinLobby(GrottoLobby lobby)
        {
            if (lobby.hasPassword)
            {
                // Show password dialog (simplified - you can expand this)
                var password = ""; // Implement password dialog
                await GrottoNetwork.JoinLobby(lobby, password);
            }
            else
            {
                await GrottoNetwork.JoinLobby(lobby);
            }
        }

        private async void JoinByCode()
        {
            if (lobbyCodeInput == null || string.IsNullOrEmpty(lobbyCodeInput.text))
                return;

            await GrottoNetwork.JoinLobby(lobbyCodeInput.text.ToUpper());
        }

        private void ShowHostDialog()
        {
            if (hostDialog) hostDialog.SetActive(true);
        }

        private void HideHostDialog()
        {
            if (hostDialog) hostDialog.SetActive(false);
        }

        private async void ConfirmHost()
        {
            var lobbyName = lobbyNameInput?.text ?? "My Lobby";
            var maxPlayers = 8;
            if (maxPlayersInput && int.TryParse(maxPlayersInput.text, out int mp))
                maxPlayers = Mathf.Clamp(mp, 2, 32);

            var isPublic = publicToggle?.isOn ?? true;
            var password = passwordInput?.text;

            HideHostDialog();
            await GrottoNetwork.HostLobby(lobbyName, maxPlayers, isPublic, password);
        }

        private void OnLobbyCreated(GrottoLobby lobby)
        {
            Debug.Log($"[Grotto] Created lobby: {lobby.name} ({lobby.code})");
            LoadGameScene();
        }

        private void OnJoinedLobby(GrottoLobby lobby)
        {
            Debug.Log($"[Grotto] Joined lobby: {lobby.name}");
            LoadGameScene();
        }

        private void OnJoinFailed(string error)
        {
            Debug.LogError($"[Grotto] Failed to join: {error}");
            // Show error to user (implement toast/popup)
        }

        private void LoadGameScene()
        {
            if (!string.IsNullOrEmpty(gameSceneName))
                UnityEngine.SceneManagement.SceneManager.LoadScene(gameSceneName);
        }

        private IEnumerator AutoRefresh()
        {
            while (true)
            {
                yield return new WaitForSeconds(autoRefreshInterval);
                RefreshLobbies();
            }
        }
    }
}

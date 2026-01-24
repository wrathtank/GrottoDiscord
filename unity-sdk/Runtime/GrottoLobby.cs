using System;
using System.Collections.Generic;

namespace Grotto.Networking
{
    /// <summary>
    /// Represents a game lobby/room.
    /// </summary>
    [Serializable]
    public class GrottoLobby
    {
        public string id;
        public string code;
        public string name;
        public string hostId;
        public int playerCount;
        public int maxPlayers;
        public bool isPublic;
        public bool hasPassword;
        public List<GrottoPlayer> players;

        // Local state (not from server)
        [NonSerialized] public bool isHost;

        public bool IsFull => playerCount >= maxPlayers;
    }

    /// <summary>
    /// Represents a player in a lobby.
    /// </summary>
    [Serializable]
    public class GrottoPlayer
    {
        public string id;
        public string name;
        public bool isHost;
        public Dictionary<string, string> metadata;
    }
}

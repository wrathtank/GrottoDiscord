// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

/**
 * @title OpenAirdropper
 * @notice Permissionless airdrop contract - anyone can use it
 * @dev Caller must approve tokens before calling airdrop functions
 */
contract OpenAirdropper {
    using SafeERC20 for IERC20;

    struct AirdropContentERC20 {
        address recipient;
        uint256 amount;
    }

    struct AirdropContentERC721 {
        address recipient;
        uint256 tokenId;
    }

    struct AirdropContentERC1155 {
        address recipient;
        uint256 tokenId;
        uint256 amount;
    }

    event AirdropERC20(address indexed token, address indexed sender, uint256 recipientCount, uint256 totalAmount);
    event AirdropERC721(address indexed token, address indexed sender, uint256 recipientCount);
    event AirdropERC1155(address indexed token, address indexed sender, uint256 recipientCount);
    event AirdropNative(address indexed sender, uint256 recipientCount, uint256 totalAmount);

    /**
     * @notice Airdrop ERC20 tokens to multiple recipients
     * @param _tokenAddress The ERC20 token to airdrop
     * @param _contents Array of {recipient, amount} structs
     */
    function airdropERC20(
        address _tokenAddress,
        AirdropContentERC20[] calldata _contents
    ) external {
        require(_contents.length > 0, "No recipients");

        IERC20 token = IERC20(_tokenAddress);
        uint256 totalAmount = 0;

        for (uint256 i = 0; i < _contents.length; i++) {
            require(_contents[i].recipient != address(0), "Invalid recipient");
            token.safeTransferFrom(msg.sender, _contents[i].recipient, _contents[i].amount);
            totalAmount += _contents[i].amount;
        }

        emit AirdropERC20(_tokenAddress, msg.sender, _contents.length, totalAmount);
    }

    /**
     * @notice Airdrop native tokens (ETH/HERESY) to multiple recipients
     * @param _contents Array of {recipient, amount} structs
     */
    function airdropNativeToken(
        AirdropContentERC20[] calldata _contents
    ) external payable {
        require(_contents.length > 0, "No recipients");

        uint256 totalSent = 0;

        for (uint256 i = 0; i < _contents.length; i++) {
            require(_contents[i].recipient != address(0), "Invalid recipient");

            (bool success, ) = _contents[i].recipient.call{value: _contents[i].amount}("");
            require(success, "Transfer failed");

            totalSent += _contents[i].amount;
        }

        require(totalSent == msg.value, "Incorrect ETH amount");

        emit AirdropNative(msg.sender, _contents.length, totalSent);
    }

    /**
     * @notice Airdrop ERC721 NFTs to multiple recipients
     * @param _tokenAddress The ERC721 token to airdrop
     * @param _contents Array of {recipient, tokenId} structs
     */
    function airdropERC721(
        address _tokenAddress,
        AirdropContentERC721[] calldata _contents
    ) external {
        require(_contents.length > 0, "No recipients");

        IERC721 token = IERC721(_tokenAddress);

        for (uint256 i = 0; i < _contents.length; i++) {
            require(_contents[i].recipient != address(0), "Invalid recipient");
            token.safeTransferFrom(msg.sender, _contents[i].recipient, _contents[i].tokenId);
        }

        emit AirdropERC721(_tokenAddress, msg.sender, _contents.length);
    }

    /**
     * @notice Airdrop ERC1155 tokens to multiple recipients
     * @param _tokenAddress The ERC1155 token to airdrop
     * @param _contents Array of {recipient, tokenId, amount} structs
     */
    function airdropERC1155(
        address _tokenAddress,
        AirdropContentERC1155[] calldata _contents
    ) external {
        require(_contents.length > 0, "No recipients");

        IERC1155 token = IERC1155(_tokenAddress);

        for (uint256 i = 0; i < _contents.length; i++) {
            require(_contents[i].recipient != address(0), "Invalid recipient");
            token.safeTransferFrom(
                msg.sender,
                _contents[i].recipient,
                _contents[i].tokenId,
                _contents[i].amount,
                ""
            );
        }

        emit AirdropERC1155(_tokenAddress, msg.sender, _contents.length);
    }

    /**
     * @notice Batch airdrop same amount of ERC20 to multiple recipients
     * @param _tokenAddress The ERC20 token to airdrop
     * @param _recipients Array of recipient addresses
     * @param _amountEach Amount to send to each recipient
     */
    function airdropERC20Equal(
        address _tokenAddress,
        address[] calldata _recipients,
        uint256 _amountEach
    ) external {
        require(_recipients.length > 0, "No recipients");

        IERC20 token = IERC20(_tokenAddress);

        for (uint256 i = 0; i < _recipients.length; i++) {
            require(_recipients[i] != address(0), "Invalid recipient");
            token.safeTransferFrom(msg.sender, _recipients[i], _amountEach);
        }

        emit AirdropERC20(_tokenAddress, msg.sender, _recipients.length, _amountEach * _recipients.length);
    }

    /**
     * @notice Batch airdrop same amount of native token to multiple recipients
     * @param _recipients Array of recipient addresses
     * @param _amountEach Amount to send to each recipient
     */
    function airdropNativeTokenEqual(
        address[] calldata _recipients,
        uint256 _amountEach
    ) external payable {
        require(_recipients.length > 0, "No recipients");
        require(msg.value == _amountEach * _recipients.length, "Incorrect ETH amount");

        for (uint256 i = 0; i < _recipients.length; i++) {
            require(_recipients[i] != address(0), "Invalid recipient");

            (bool success, ) = _recipients[i].call{value: _amountEach}("");
            require(success, "Transfer failed");
        }

        emit AirdropNative(msg.sender, _recipients.length, msg.value);
    }
}

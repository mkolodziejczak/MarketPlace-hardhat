// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract Collection is ERC721, ERC721URIStorage, Ownable {

    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;

    bytes32 public DOMAIN_SEPARATOR;

    bytes32 private immutable PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 tokenId,uint256 nonce,uint256 deadline)");

    mapping(uint256 => Counters.Counter) private _nonces;    

    constructor(string memory collectionName, string memory symbol) ERC721(collectionName, symbol) {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,address verifyingContract)"
                ),
                keccak256(bytes(collectionName)),
                keccak256(bytes("1")),
                address(this)
            )
        );
    }

    function nonces(uint256 tokenId) external view returns (uint256)
    {
        return _nonces[tokenId].current();
    }

    function safeMint(address to, string memory uri) public onlyOwner returns ( uint ) {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        return tokenId;
    }

    // The following functions are overrides required by Solidity.

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function permitManagement( address owner, address spender, uint256 tokenId, uint256 deadline, uint8 v, bytes32 r, bytes32 s ) external {
        bool success = permit(owner, spender, tokenId, deadline, v, r, s);
        _nonces[tokenId].increment();
        if( !success ){
            revert("Acquiring permission failed");
        }
        _approve(spender, tokenId);
    }

    function permit(address owner, address spender, uint256 tokenId, uint256 deadline, uint8 v, bytes32 r, bytes32 s) internal view returns(bool) {
        require(owner == ERC721.ownerOf(tokenId), "User is not the owner of the token");
        require(deadline >= block.timestamp, "ERC721WithPermit: EXPIRED");

        bytes32 digest =
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    DOMAIN_SEPARATOR,
                    keccak256(
                        abi.encode(
                            PERMIT_TYPEHASH,
                            owner,
                            spender,
                            tokenId,
                            _nonces[tokenId].current(),
                            deadline
                        )
                    )
                )
            );

        address recoveredAddress = ecrecover(digest, v, r, s);
        require(
            recoveredAddress != address(0) && recoveredAddress == owner,
            "ERC721WithPermit: INVALID_SIGNATURE"
        );

        return true;
    }
}

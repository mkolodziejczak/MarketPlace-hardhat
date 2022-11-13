// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./Collection.sol";

contract CollectionRegistry {

    struct CollectionStruct {
        address addr;
        string name;
        string symbol;
        address creator;
    }

    mapping( address => CollectionStruct[] ) public userToCollections;
    mapping( address => CollectionStruct ) public collectionRegistry;
    mapping( address => bool ) public collectionAvailability;


    modifier onlyRegisteredCollection( Collection collection ) {
        require( collectionAvailability[ address( collection) ], "Address is not a Marketplace Collection." );
        _;
    }

    modifier onlyItemOwner( Collection collection, uint tokenId ) {
        require( collection.ownerOf( tokenId ) == msg.sender, "User is not the owner of the item." );
        _;
    }

    function createNewCollection( string memory collectionName, string memory collectionSymbol ) external returns ( address addr ) {
        bytes memory contractBytecode = getCollectionBytecode( collectionName, collectionSymbol );
        assembly {
            addr := create(0, add(contractBytecode, 0x20), mload(contractBytecode))
        }

        require(addr != address(0), "Collection creation failed");

        CollectionStruct memory collection = CollectionStruct( addr, collectionName, collectionSymbol, msg.sender );
        userToCollections[ msg.sender ].push( collection );
        collectionRegistry[ addr ] = collection;
    }


    function getCollectionBytecode(string memory collectionName, string memory collectionSymbol) internal pure returns (bytes memory) {
        bytes memory bytecode = type(Collection).creationCode;
        return abi.encodePacked(bytecode, abi.encode( collectionName, collectionSymbol));
    }

    function isRegisteredCollection( address collectionAddress ) external view returns ( bool ) {
        return collectionAvailability[ collectionAddress ];
    }

    function isUserCollectionOwner( address collectionAddress, address user ) external view returns ( bool ) {
        return collectionRegistry[ collectionAddress ].creator == user;
    }

}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./Collection.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Marketplace is Ownable {

    uint public fee;

    struct Offer {
        uint price;
        bool active;
    }

    struct Listing {
        uint price;
        uint feePaid;
    }

    struct CollectionStruct {
        address addr;
        string name;
        string symbol;
        address creator;
    }

    mapping( address => CollectionStruct[] ) public userToCollections;
    mapping( address => CollectionStruct ) public collectionRegistry;
    mapping( address => bool ) public collectionAvailability;

    mapping( address => uint256 ) public userToFunds;

    mapping( address => mapping( uint => Listing) ) public listings;
    mapping( address => mapping( uint => bool) ) public listingAvailability;

    mapping( address => mapping( uint => mapping( address => Offer ) ) ) public offers;
    mapping( address => mapping( uint => mapping( address => bool ) ) ) public offerAvailability;


    event CollectionCreated( string collectionName, string collectionSymbol, address collectionAddress, address user );
    event ItemCreated( uint indexed tokenId, address indexed collectionAddress, address indexed userAddress, string uri );
    event TradeConfirmed( uint indexed tokenId, address indexed collecionAddress, address fromUser, address indexed toUser, uint price );
    event ItemListedForSale( uint indexed tokenId, address indexed colectionAddress, uint price );
    event ItemWithdrawnFromSale( uint indexed tokenId, address indexed colectionAddress );
    event WithdrawalOfFunds( address indexed userAddress, uint funds );
    event DepositOfFunds( address indexed userAddress, uint funds );
    event OfferMade( uint indexed tokenId, address indexed collectionAddress, address indexed offerer, uint price );
    event OfferWithdrawn( uint indexed tokenId, address indexed collectionAddress, address indexed offerer );
    event OfferRejected( uint indexed tokenId, address indexed collectionAddress, address indexed offerer );
    event MarketplaceApprovedForToken( uint indexed tokenId, address indexed collectionAddress );
    event MarketplacePermissionsRevoked( uint indexed tokenId, address indexed collectionAddress );



    constructor( uint startingFee ) {
        fee = startingFee;
    }
    

    modifier onlyRegisteredCollection( Collection collection ) {
        require( collectionAvailability[ address( collection ) ], "Address is not a Marketplace Collection." );
        _;
    }

    modifier onlyItemOwner( Collection collection, uint tokenId ) {
        require( collection.ownerOf( tokenId ) == msg.sender, "User is not the owner of the item." );
        _;
    }

    modifier mustNotBeOwner( Collection collection, uint tokenId ) {
        require( collection.ownerOf( tokenId ) != msg.sender, "User is the owner of the item." );
        _;
    }

    modifier offerMustExist( Collection collection, uint tokenId, address offerersAddress ) {
        require( offerAvailability[ address( collection) ] [ tokenId ] [ offerersAddress ], "No offer made for that item.");
        _;
    }
    
    modifier offerMustBeActive( Collection collection, uint tokenId, address offerersAddress ) {
        require( offers[ address( collection) ] [ tokenId ] [ offerersAddress ].active, "Offer already inactive." );
        _;
    }

    modifier processingFeeMustBePaid( uint _fee ) {
        require( _fee >= fee, "Deposited fee is insufficient to trade." );
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
        collectionAvailability[ addr ] = true;

        emit CollectionCreated( collectionName, collectionSymbol, addr, msg.sender );
    }


    function getCollectionBytecode(string memory collectionName, string memory collectionSymbol) internal pure returns (bytes memory) {
        bytes memory bytecode = type(Collection).creationCode;
        return abi.encodePacked(bytecode, abi.encode( collectionName, collectionSymbol));
    }
    

    function setFee( uint _fee ) onlyOwner external {
        fee = _fee;
    }

    function withdrawFunds( uint256 amount ) external {
        require( userToFunds[ msg.sender ] >= amount, "Insufficient funds." );
        userToFunds[ msg.sender ] = userToFunds[ msg.sender ] - amount;
        ( bool sent, ) = msg.sender.call{ value: amount }("");
        require( sent, "Failed to send Ether." );

        emit WithdrawalOfFunds( msg.sender, amount );
    }

    function grantPermission( Collection collection, uint tokenId, uint256 deadline, uint8 v, bytes32 r, bytes32 s ) onlyRegisteredCollection( collection )  external {
        collection.permitManagement(msg.sender, address(this), tokenId, deadline, v,r,s);
        emit MarketplaceApprovedForToken( tokenId, address( collection ) );
    }
    
    function revokePermission( Collection collection, uint tokenId, uint256 deadline, uint8 v, bytes32 r, bytes32 s ) onlyRegisteredCollection( collection ) external {
        collection.permitManagement(msg.sender, address(0), tokenId, deadline, v,r,s);
        emit MarketplacePermissionsRevoked( tokenId, address( collection ) );
    }

    function getTokenNonce( Collection collection, uint tokenId ) onlyRegisteredCollection( collection ) onlyItemOwner( collection, tokenId ) external view returns( uint ) {
        return collection.nonces( tokenId );
    }

    function approveAnOffer( Collection collection, uint tokenId, address offerersAddress ) onlyRegisteredCollection( collection ) onlyItemOwner( collection, tokenId ) offerMustExist( collection, tokenId, offerersAddress ) offerMustBeActive( collection, tokenId, offerersAddress ) processingFeeMustBePaid( msg.value ) external payable {
        require(collection.getApproved( tokenId ) == address( this ), "Marketplace hasn't been approved for management of this token.");
        offerAvailability[ address( collection) ] [ tokenId ] [ offerersAddress ] = false;

        if( msg.value > fee ) {
            userToFunds[ msg.sender ] += msg.value - fee;
        }

        userToFunds[ owner() ] += fee;
        
        uint price = offers[ address( collection) ] [ tokenId ] [ offerersAddress ].price;
        userToFunds[ msg.sender ] += price;

        
        uint token = tokenId;
        collection.safeTransferFrom( msg.sender, offerersAddress, token );

        emit TradeConfirmed( tokenId, address( collection ), msg.sender, offerersAddress, price );
    }

    function rejectAnOffer( Collection collection, uint tokenId, address offerersAddress ) onlyRegisteredCollection( collection ) onlyItemOwner( collection, tokenId ) offerMustExist( collection, tokenId, offerersAddress ) offerMustBeActive( collection, tokenId, offerersAddress ) external {

        offers[ address( collection) ] [ tokenId ] [ offerersAddress ].active = false;
        offerAvailability[ address( collection) ] [ tokenId ] [ offerersAddress ] = false;
        userToFunds[ offerersAddress ] += offers[ address( collection) ] [ tokenId ] [ offerersAddress ].price;

        emit OfferRejected( tokenId, address( collection ), offerersAddress );
    }

    function withdrawAnOffer( Collection collection, uint tokenId ) onlyRegisteredCollection( collection ) offerMustExist( collection, tokenId, msg.sender ) offerMustBeActive( collection, tokenId, msg.sender ) external {
        offerAvailability[ address( collection) ] [ tokenId ] [ msg.sender ] = false;

        userToFunds[ msg.sender ] += offers[ address( collection) ] [ tokenId ] [ msg.sender ].price;

        emit OfferWithdrawn( tokenId, address( collection ), msg.sender );
    }

    function makeAnOffer( Collection collection, uint tokenId ) onlyRegisteredCollection( collection ) mustNotBeOwner(collection, tokenId ) external payable {
        require( offerAvailability[ address( collection) ] [ tokenId ] [ msg.sender ] == false, "Offer already made for that item.");
        require( collection.requireMinted(tokenId), "Item must be minted first");

        Offer memory offer = Offer( msg.value, true );
        offers[ address( collection ) ] [ tokenId ] [ msg.sender ] = offer ;
        offerAvailability[ address( collection) ] [ tokenId ] [ msg.sender ] = true;

        emit OfferMade( tokenId, address( collection ), msg.sender, msg.value );
    }

    function buyAnItem( Collection collection, uint tokenId ) onlyRegisteredCollection( collection ) mustNotBeOwner( collection, tokenId ) external payable {
        require( listingAvailability[ address( collection ) ] [ tokenId ], "Listing for that item doesn't exist.");
        require( msg.value >= listings[ address( collection ) ] [ tokenId ].price , "Amount paid is insufficient.");

        uint price = listings[ address( collection ) ] [ tokenId ].price;
        
        if( msg.value > price ) {
            userToFunds[ msg.sender ] += msg.value - price;
        }

        userToFunds[ owner() ] += listings[ address( collection ) ] [ tokenId ].feePaid;
        
        address tokenOwner = collection.ownerOf( tokenId );
        userToFunds[ tokenOwner ] += price;

        collection.safeTransferFrom( tokenOwner, msg.sender, tokenId );
        delete listings[ address( collection ) ] [ tokenId ];
        emit TradeConfirmed( tokenId, address( collection ), tokenOwner, msg.sender, price );
    }

    function withdrawFromSale( Collection collection, uint tokenId ) onlyRegisteredCollection( collection ) onlyItemOwner( collection, tokenId ) external {
        require( listingAvailability[ address( collection ) ] [ tokenId ], "Listing for that item doesn't exist.");

        listingAvailability[ address( collection ) ] [ tokenId ] = false;
        userToFunds[ msg.sender ] += listings[ address( collection ) ] [ tokenId ].feePaid;

        emit ItemWithdrawnFromSale( tokenId, address( collection ) );
    }

    function listForSale( Collection collection, uint tokenId, uint price ) onlyRegisteredCollection( collection) onlyItemOwner( collection, tokenId ) processingFeeMustBePaid( msg.value )  external payable {
        require(collection.getApproved( tokenId ) == address( this ), "Marketplace hasn't been approved for management of this token.");
        require( listingAvailability[ address( collection ) ] [ tokenId ] == false, "Listing already created." );
        
        if( msg.value > fee ) {
            userToFunds[ msg.sender ] += msg.value - fee;
        }

        listings[ address( collection ) ] [ tokenId ] = Listing( price, fee );
        listingAvailability[ address( collection ) ] [ tokenId ] = true;

        emit ItemListedForSale( tokenId, address( collection ), price );
    }

    function createNewToken( Collection collection, string memory uri ) onlyRegisteredCollection( collection) external {
        require( collectionRegistry[ address( collection ) ].creator == msg.sender , "User is not the owner of the collection." );

        uint tokenId = collection.safeMint( msg.sender, uri );
        emit ItemCreated( tokenId, address( collection ), msg.sender, uri );
    }

    fallback() external payable {
        userToFunds[ msg.sender ] += msg.value;
        emit DepositOfFunds( msg.sender, msg.value );
    }

    receive() external payable {
        userToFunds[ msg.sender ] += msg.value;
        emit DepositOfFunds( msg.sender, msg.value );
    }

}

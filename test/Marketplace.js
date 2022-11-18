const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Marketplace", function () {   

    let marketplaceFactory;

    let marketplace;
    let unregisteredCollection;

    let collAddress = '0xa16E02E87b7454126E5E10d957A927A7F5B5d2be';
    let testUri = 'ipfs://testuri';

    async function onAttemptToApprove( collectionAddress, tokenId, account ) {
      // Account here is the wallete address
      const nonce = await marketplace.getTokenNonce(collectionAddress, tokenId); // Our Token Contract Nonces
      const deadline = + new Date() + 60 * 60; // Permit with deadline which the permit is valid
      const collection = await marketplace.collectionRegistry( collectionAddress );
        
      const EIP712Domain = [ // array of objects -> properties from the contract and the types of them ircwithPermit
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'verifyingContract', type: 'address' }
      ];
  
      const domain = {
          name: collection.name,
          version: '1',
          verifyingContract: collectionAddress
      };
  
      const Permit = [ // array of objects -> properties from erc20withpermit
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'tokenId', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
      ];
  
      const message = {
          owner: account.address, // Wallet Address
          spender: marketplace.address, // **This is the address of the spender whe want to give permit to.**
          tokenId: tokenId,
          nonce: nonce.toHexString(),
          deadline
      };
  
      const data = JSON.stringify({
          types: {
              EIP712Domain,
              Permit
          },
          domain,
          primaryType: 'Permit',
          message
      });
  
      //const signatureLike = await account.send('eth_signTypedData_v4', [account.address, data]); // Library is a provider.
      const signatureLike = await account._signTypedData(
          domain,
          {
              Permit
          },
          message
      );
      const signature = await ethers.utils.splitSignature(signatureLike);
  
      const preparedSignature = {
          v: signature.v,
          r: signature.r,
          s: signature.s,
          deadline,
          tokenId
      };
  
      return preparedSignature;
    }

    before(async () => {

        marketplaceFactory = await ethers.getContractFactory("Marketplace");
        collectionFactory = await ethers.getContractFactory("Collection");

        marketplace = await marketplaceFactory.deploy( 30000 );
        await marketplace.deployed();
        
        unregisteredCollection = await collectionFactory.deploy("Unregistered Collection", "UC" );
        await unregisteredCollection.deployed();

    });

    it("Should create a given collection", async function () {
        const [creator] = await ethers.getSigners();
        await expect(marketplace.connect(creator).createNewCollection("New Collection", "Col")).to.emit(marketplace, 'CollectionCreated').withArgs('New Collection', 'Col', collAddress, creator.address);
    });
  
    it("Should create new token for collection", async function () {
      const [creator] = await ethers.getSigners();
      await expect(marketplace.connect(creator).createNewToken(collAddress, testUri)).to.emit(marketplace, 'ItemCreated').withArgs(0, collAddress, creator.address, testUri);
    });
  
    it("Should throw on trying to call an unregistered collection", async function () {
      const [creator] = await ethers.getSigners();
      await expect(marketplace.connect(creator).createNewToken(unregisteredCollection.address, testUri)).to.be.revertedWith('Address is not a Marketplace Collection.');
    });
  
    it("Should throw on trying to call a collection by not an owner", async function () {
      const [creator, notOwner] = await ethers.getSigners();
      await expect(marketplace.connect(notOwner).createNewToken(collAddress, testUri)).to.be.revertedWith('User is not the owner of the collection.');
    });

    it("Should throw on trying to call a collection by not an owner", async function () {
      const [creator, notOwner] = await ethers.getSigners();
      await expect(marketplace.connect(notOwner).createNewToken(collAddress, testUri)).to.be.revertedWith('User is not the owner of the collection.');
    });

    it("Should throw on trying to list item without paying fee", async function () {
      const [creator] = await ethers.getSigners();
      await expect(marketplace.connect(creator).listForSale(collAddress, 0, 3000000000)).to.be.revertedWith("Deposited fee is insufficient to trade.");
    });

    it("Should throw on trying to list item without approval", async function () {
      const [creator] = await ethers.getSigners();
      await expect(marketplace.connect(creator).listForSale(collAddress, 0, 3000000000, {
        value: ethers.utils.parseEther("1.0")
      })).to.be.revertedWith("Marketplace hasn't been approved for management of this token.");
    });

    it("Should grant permission for Marketplace to manage token", async function () {
      const [creator] = await ethers.getSigners();

      const signature = await onAttemptToApprove( collAddress, 0, creator );
      await expect(marketplace.connect(creator).grantPermission(collAddress, signature.tokenId, signature.deadline, signature.v, signature.r, signature.s )).to.emit(marketplace, 'MarketplaceApprovedForToken').withArgs(0, collAddress);
    });
});
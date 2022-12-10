const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Marketplace", function () {   

    let marketplaceFactory;

    let marketplace;
    let unregisteredCollection;

    let zeroAddress = "0x0000000000000000000000000000000000000000";
    let collAddress = '0xa16E02E87b7454126E5E10d957A927A7F5B5d2be';
    let testUri = 'ipfs://testuri';
    let creator, buyer;

    async function onAttemptToApprove( collectionAddress, tokenId, account, spender ) {
      // Account here is the wallete address
      const nonce = await marketplace.connect(account).getTokenNonce(collectionAddress, tokenId); // Our Token Contract Nonces
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
          spender: spender, // **This is the address of the spender whe want to give permit to.**
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

        marketplace = await marketplaceFactory.deploy( ethers.utils.parseUnits('1', 'gwei') );
        await marketplace.deployed();
        
        unregisteredCollection = await collectionFactory.deploy("Unregistered Collection", "UC" );
        await unregisteredCollection.deployed();

        
        [creator, buyer] = await ethers.getSigners();
    });

    it("Should create a given collection", async function () {
        await expect(marketplace.connect(creator).createNewCollection("New Collection", "Col")).to.emit(marketplace, 'CollectionCreated').withArgs('New Collection', 'Col', collAddress, creator.address);
    });
  
    it("Should create new token for collection", async function () {
      await expect(marketplace.connect(creator).createNewToken(collAddress, testUri)).to.emit(marketplace, 'ItemCreated').withArgs(0, collAddress, creator.address, testUri);
    });
  
    it("Should throw on trying to call an unregistered collection", async function () {
      await expect(marketplace.connect(creator).createNewToken(unregisteredCollection.address, testUri)).to.be.revertedWith('Address is not a Marketplace Collection.');
    });
  
    it("Should throw on trying to call a collection by not an owner", async function () {
      await expect(marketplace.connect(buyer).createNewToken(collAddress, testUri)).to.be.revertedWith('User is not the owner of the collection.');
    });

    it("Should throw on trying to list item without paying fee", async function () {
      await expect(marketplace.connect(creator).listForSale(collAddress, 0, ethers.utils.parseUnits('3', 'gwei'))).to.be.revertedWith("Deposited fee is insufficient to trade.");
    });

    it("Should throw on trying to list item without approval", async function () {
      await expect(marketplace.connect(creator).listForSale(collAddress, 0, ethers.utils.parseUnits('3', 'gwei'), {
        value: ethers.utils.parseEther("1.0")
      })).to.be.revertedWith("Marketplace hasn't been approved for management of this token.");
    });

    it("Should grant permission for Marketplace to manage token", async function () {
      const [creator] = await ethers.getSigners();

      const signature = await onAttemptToApprove( collAddress, 0, creator, marketplace.address );
      await expect(marketplace.connect(creator).grantPermission(collAddress, signature.tokenId, signature.deadline, signature.v, signature.r, signature.s )).to.emit(marketplace, 'MarketplaceApprovedForToken').withArgs(0, collAddress);
    });

    it("Should list token for sale", async function () {
      const price = ethers.utils.parseUnits('3', 'gwei');
      await expect(marketplace.connect(creator).listForSale(collAddress, 0, price, {
        value: ethers.utils.parseUnits('1', 'gwei')
      })).to.emit(marketplace, 'ItemListedForSale').withArgs(0, collAddress, price);
    });

    it("Should withdraw token for sale", async function () {
      await expect(marketplace.connect(creator).withdrawFromSale(collAddress, 0)).to.emit(marketplace, 'ItemWithdrawnFromSale').withArgs(0, collAddress);
    });

    it("Should throw when trying to widthraw unlisted token", async function () {
      await expect(marketplace.connect(creator).withdrawFromSale(collAddress, 0)).to.be.revertedWith("Listing for that item doesn't exist.");
    });

    it("Should throw when trying to buy unlisted token", async function () {
      await expect(marketplace.connect(buyer).buyAnItem(collAddress, 0)).to.be.revertedWith("Listing for that item doesn't exist.");
    });

    it("Should throw when trying to buy with insufficent funds", async function () {
      const price = ethers.utils.parseUnits('3', 'gwei');

      await marketplace.connect(creator).listForSale(collAddress, 0, price, {
        value: ethers.utils.parseUnits('1', 'gwei')
      });
      await expect(marketplace.connect(buyer).buyAnItem(collAddress, 0, {
        value: ethers.utils.parseUnits('2', 'gwei')
      })).to.be.revertedWith("Amount paid is insufficient.");
    });

    it("Should buy listed", async function () {
      const price = ethers.utils.parseUnits('3', 'gwei');

      await expect(marketplace.connect(buyer).buyAnItem(collAddress, 0, {
        value: price
      })).to.emit(marketplace, 'TradeConfirmed').withArgs(0, collAddress, creator.address, buyer.address, price);
    });

    it("Should withdraw funds", async function () {
      const price = ethers.utils.parseUnits('3', 'gwei');

      await expect(marketplace.connect(creator).withdrawFunds( price )).to.emit(marketplace, 'WithdrawalOfFunds').withArgs(creator.address, price);
    });

    it("Should throw when trying to withdraw with insufficient funds", async function () {
      const price = ethers.utils.parseUnits('3', 'gwei');

      await expect(marketplace.connect(creator).withdrawFunds( price )).to.be.revertedWith("Insufficient funds.");
    });

    it("Should throw when trying to make an offer as owner", async function () {

      await expect(marketplace.connect(buyer).makeAnOffer( collAddress, 0 )).to.be.revertedWith("User is the owner of the item.");
    });

    it("Should allow to make an offer", async function () {
      const price = ethers.utils.parseUnits('2', 'gwei');

      await expect(marketplace.connect(creator).makeAnOffer( collAddress, 0,{
        value: price
      } )).to.emit(marketplace, 'OfferMade').withArgs(0, collAddress, creator.address, price);
    });

    it("Should throw when trying to make an offer with offer already made", async function () {
      const price = ethers.utils.parseUnits('2', 'gwei');

      await expect(marketplace.connect(creator).makeAnOffer( collAddress, 0,{
        value: price
      }  )).to.be.revertedWith("Offer already made for that item.");
    });

    it("Should allow to withdraw an offer", async function () {

      await expect(marketplace.connect(creator).withdrawAnOffer( collAddress, 0)).to.emit(marketplace, 'OfferWithdrawn').withArgs(0, collAddress, creator.address);
    });

    it("Should allow to reject an offer", async function () {
      const price = ethers.utils.parseUnits('2', 'gwei');

      await marketplace.connect(creator).makeAnOffer( collAddress, 0,{
        value: price
      });
      await expect(marketplace.connect(buyer).rejectAnOffer( collAddress, 0, creator.address)).to.emit(marketplace, 'OfferRejected').withArgs(0, collAddress, creator.address);
    });

    it("Should allow to accept an offer", async function () {
      const price = ethers.utils.parseUnits('2', 'gwei');

      await marketplace.connect(creator).makeAnOffer( collAddress, 0,{
        value: price
      });

      const signature = await onAttemptToApprove( collAddress, 0, buyer, marketplace.address );
      await marketplace.connect(buyer).grantPermission( collAddress, signature.tokenId, signature.deadline, signature.v, signature.r, signature.s );
 
      await expect(marketplace.connect(buyer).approveAnOffer( collAddress, 0, creator.address,{
        value: ethers.utils.parseUnits('1', 'gwei')
      })).to.emit(marketplace, 'TradeConfirmed').withArgs(0, collAddress, buyer.address, creator.address, price);
    });

    it("Should revoke marketplace permissions", async function () {
      const signature = await onAttemptToApprove( collAddress, 0, creator, zeroAddress );
      await expect(marketplace.connect(creator).revokePermission( collAddress, signature.tokenId, signature.deadline, signature.v, signature.r, signature.s )).to.emit(marketplace, 'MarketplacePermissionsRevoked').withArgs(0, collAddress);
    });

    it("Should increment nonce on each signature", async function () {
      const currentNonce = await marketplace.connect(creator).getTokenNonce(collAddress, 0); 
      expect(currentNonce).to.equal(3);
    });

    it("Should deposit funds to user's marketplace balance", async function () {
      const funds = ethers.utils.parseUnits('2', 'gwei');
      const transaction = {
        to: marketplace.address,
        value: funds
      };
      
      await expect(creator.sendTransaction(transaction)).to.emit(marketplace, 'DepositOfFunds').withArgs(creator.address, funds);
    });
});
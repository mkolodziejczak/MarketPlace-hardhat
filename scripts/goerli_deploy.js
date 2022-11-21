const hre = require('hardhat')
const ethers = hre.ethers;

async function deployMarketContract( fee, _privateKey) {
    await hre.run('compile'); 
    const wallet = new ethers.Wallet(_privateKey, hre.ethers.provider) 
    await hre.run('print', { message: 'Deploying contracts with the account:' + wallet.address });
    await hre.run('print', { message: 'Account balance:' + (await wallet.getBalance()).toString() }); 

    const Marketplace = await ethers.getContractFactory("Marketplace", wallet); 
    const marketplaceContract = await Marketplace.deploy( fee );
    await hre.run('print', { message: 'Waiting for Marketplace deployment...'});
    await marketplaceContract.deployed();

    await hre.run('print', { message: "Marketplace Goerli Contract address: " + marketplaceContract.address });
    await hre.run('print', { message: "Waiting for 5 transaction confirmations to make sure it's propagated..."});
    await marketplaceContract.deployTransaction.wait(5);

    await hre.run('print', { message: "Verifying on Etherscan..."});
    await hre.run("verify:verify", {
      address: marketplaceContract.address,
      constructorArguments: [],
    });

    await hre.run('print', { message: "Done !!! "});

}
  
module.exports = deployMarketContract;
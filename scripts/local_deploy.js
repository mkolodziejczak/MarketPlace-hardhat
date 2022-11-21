const hre = require('hardhat')
const ethers = hre.ethers;

async function deployMarketplaceContract( fee ) {
  await hre.run('compile');
  const Marketplace = await hre.ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy( fee );

  await marketplace.deployed();

  await hre.run('print', { message: "Marketplace deployed to " + marketplace.address });

}


module.exports = deployMarketplaceContract;

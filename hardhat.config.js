require("@nomicfoundation/hardhat-toolbox");
require("@nomiclabs/hardhat-etherscan");


module.exports = {
  defaultNetwork: "localhost",
  networks: {
    localhost: {
    },
    goerli: {
      url: '',
      accounts: ['']
    }
  },
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  etherscan: {
    apiKey: ''
  }
};


task("deploy-local", "Deploys contract on a local network")
.setAction(async () => {
    const deployMarketplaceContract = require("./scripts/local_deploy");
    await deployMarketplaceContract( ethers.utils.parseUnits('1', 'gwei') );
});
task("deploy-goerli", "Deploys contract on a local network")
.addParam("privateKey", "Private key of the owner account")
.setAction(async (taskArgs) => {
    const deployMarketplaceContract = require("./scripts/goerli_deploy");
    await deployMarketplaceContract( ethers.utils.parseUnits('1', 'gwei'), taskArgs.privateKey );
});

subtask("print", "Prints a message")
  .addParam("message", "The message to print")
  .setAction(async (taskArgs) => {
  console.log(taskArgs.message);
});



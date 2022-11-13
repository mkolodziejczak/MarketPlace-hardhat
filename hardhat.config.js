require("@nomicfoundation/hardhat-toolbox");
require("@nomiclabs/hardhat-etherscan");
require('dotenv').config({path: './process.env'});

const { GOERLI_URL, PRIVATE_KEY, ETHERSCAN_API_KEY } = process.env;

module.exports = {
  networks: {
    goerli: {
      url: GOERLI_URL,
      accounts: [PRIVATE_KEY]
    }
  },
  solidity: {
    version: "0.8.0",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY
  },
};

task("deploy-local", "Deploys contract on a local network")
.setAction(async () => {
    const deployLibraryContract = require("./scripts/local_deploy");
    await deployLibraryContract(PRIVATE_KEY);
});

task("deploy-goerli", "Deploys contract on a goerli network")
.setAction(async () => {
    const deployLibraryContract = require("./scripts/goerli_deploy");
    await deployLibraryContract(PRIVATE_KEY);
});

subtask("print", "Prints a message")
  .addParam("message", "The message to print")
  .setAction(async (taskArgs) => {
  console.log(taskArgs.message);
});

const hre = require("hardhat");
const Library = require('../artifacts/contracts/Library.sol/Library.json')
require('dotenv').config({path: './process.env'});
const { GOERLI_URL, PRIVATE_KEY, ETHERSCAN_API_KEY } = process.env;

const run = async function() {

    const provider = new hre.ethers.providers.JsonRpcProvider(GOERLI_URL)
    const latestBlock = await provider.getBlock("latest")

    const wallet = new hre.ethers.Wallet(PRIVATE_KEY, provider);
    const balance = await wallet.getBalance();

    const contractAddress = "0xB890E5b913028D05053d62D270e5B61678932199"
    const libraryContract = new hre.ethers.Contract(contractAddress, Library.abi, wallet)

    const transactionBook = await libraryContract.addBook("New Book", 12);
    const transactionReceipt = await transactionBook.wait();
    if (transactionReceipt.status != 1) { 
        console.log("Transaction was not successful")
        return 
    }
    
    const booksAvailable = await libraryContract.showAllAvailableBooks();
    console.log("Available books", booksAvailable)
    const chosenBook = booksAvailable[0];

    const rentTrancastion = await libraryContract.rentBook(chosenBook.id);
    const rentReceipt = await rentTrancastion.wait()
    if (rentReceipt.status != 1) { 
        console.log("Transaction was not successful")
        return 
    }

    const bookCurrentRentals = await libraryContract.showBookHistory(chosenBook.id);
    console.log("Book's rental history: ", bookCurrentRentals);


    const returnTransaction = await libraryContract.returnBook(chosenBook.id);
    const returnReceipt = await returnTransaction.wait()
    if (returnReceipt.status != 1) { 
        console.log("Transaction was not successful")
        return 
    }

    const bookAvailability = await libraryContract.bookLedger(chosenBook.id);
    console.log("Book Availability: ", bookAvailability.copies);

}

run()
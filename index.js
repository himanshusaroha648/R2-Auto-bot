require('dotenv').config();
const fs = require('fs');
const { ethers } = require('ethers');
const { HttpsProxyAgent } = require('https-proxy-agent');
const chalk = require('chalk');
const { JsonRpcProvider } = require('@ethersproject/providers');

const COLORS = {
  GREEN: 'green',
  YELLOW: 'yellow',
  RED: 'red',
  WHITE: 'white',
  GRAY: 'gray',
  CYAN: 'cyan',
  MAGENTA: 'magenta'
};

let proxies = [];
let privateKeys = [];

// Network configuration and ABIs
const NETWORKS = {
  sepolia: {
    name: 'Sepolia',
    chainId: 11155111,
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorer: 'https://sepolia.etherscan.io',
    symbol: 'ETH',
    contracts: {
      USDC_ADDRESS: '0xef84994ef411c4981328ffce5fda41cd3803fae4',
      R2USD_ADDRESS: '0x20c54c5f742f123abb49a982bfe0af47edb38756',
      SR2USD_ADDRESS: '0xbd6b25c4132f09369c354bee0f7be777d7d434fa',
      USDC_TO_R2USD_CONTRACT: '0x20c54c5f742f123abb49a982bfe0af47edb38756',
      R2USD_TO_USDC_CONTRACT: '0x07abd582df3d3472aa687a0489729f9f0424b1e3',
      STAKE_R2USD_CONTRACT: '0xbd6b25c4132f09369c354bee0f7be777d7d434fa',
      USDC_TO_R2USD_METHOD_ID: '0x095e7a95',
      R2USD_TO_USDC_METHOD_ID: '0x3df02124',
      STAKE_R2USD_METHOD_ID: '0x1a5f0f00',
    },
  },
  arbitrumSepolia: {
    name: 'Arbitrum Sepolia',
    chainId: 421614,
    rpcUrl: 'https://arbitrum-sepolia.drpc.org',
    explorer: 'https://sepolia.arbiscan.io',
    symbol: 'ETH',
    contracts: {
      USDC_ADDRESS: '0xef84994eF411c4981328fFcE5Fda41cD3803faE4',
      R2USD_ADDRESS: '0x20c54C5F742F123Abb49a982BFe0af47edb38756',
      SR2USD_ADDRESS: '0x6b9573B7dB7fB98Ff4014ca8E71F57aB7B7ffDFB',
      USDC_TO_R2USD_CONTRACT: '0xCcE6bfcA2558c15bB5faEa7479A706735Aef9634',
      R2USD_TO_USDC_CONTRACT: '0xCcE6bfcA2558c15bB5faEa7479A706735Aef9634',
      STAKE_R2USD_CONTRACT: '0x6b9573B7dB7fB98Ff4014ca8E71F57aB7B7ffDFB',
      USDC_TO_R2USD_METHOD_ID: '0x3df02124',
      R2USD_TO_USDC_METHOD_ID: '0x3df02124',
      STAKE_R2USD_METHOD_ID: '0x1a5f0f00',
    },
  },
  plumeTestnet: {
    name: 'Plume Testnet',
    chainId: 98867,
    rpcUrl: 'https://testnet-rpc.plumenetwork.xyz',
    explorer: 'https://testnet-explorer.plumenetwork.xyz',
    symbol: 'ETH',
    contracts: {
      USDC_ADDRESS: '0xef84994ef411c4981328ffce5fda41cd3803fae4',
      R2USD_ADDRESS: '0x20c54c5f742f123abb49a982bfe0af47edb38756',
      SR2USD_ADDRESS: '0xbd6b25c4132f09369c354bee0f7be777d7d434fa',
      USDC_TO_R2USD_CONTRACT: '0x20c54c5f742f123abb49a982bfe0af47edb38756',
      R2USD_TO_USDC_CONTRACT: '0x07abd582df3d3472aa687a0489729f9f0424b1e3',
      STAKE_R2USD_CONTRACT: '0xbd6b25c4132f09369c354bee0f7be777d7d434fa',
      USDC_TO_R2USD_METHOD_ID: '0x095e7a95',
      R2USD_TO_USDC_METHOD_ID: '0x3df02124',
      STAKE_R2USD_METHOD_ID: '0x1a5f0f00',
    },
  },
};

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
];

const SWAP_ABI = [
  'function exchange(int128 i, int128 j, uint256 _dx, uint256 _min_dy) external',
];

const STAKE_ABI = [
  'function stake(uint256 amount) external',
];

// Replace logWindow with console
function log(message, color = COLORS.WHITE) {
    console.log(chalk[color](message));
}

// Replace spinner with simple console messages
function showSpinner(startMessage, endMessage, timeout) {
    console.log(chalk[COLORS.YELLOW](startMessage));
    return () => {
        console.log(chalk[COLORS.GREEN](endMessage));
    };
}

// Update menu display
async function showMenu(wallets) {
    console.clear();
    console.log(chalk[COLORS.GREEN]('╔════════════════════════════════════════════╗'));
    console.log(chalk[COLORS.GREEN]('║         R2 AUTO BOT - BY HIMANSHU SAROHA         ║'));
    console.log(chalk[COLORS.GREEN]('╚════════════════════════════════════════════╝\n'));

    // Display balances for each wallet
    console.log(chalk[COLORS.CYAN]('╔════════ Current Balances ════════╗'));
    for (const walletObj of wallets) {
        const wallet = walletObj.wallet;
        const network = walletObj.network;
        console.log(chalk[COLORS.CYAN](`Wallet: ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)} (${network.name})`));
        try {
            // Get ETH balance first
            const ethBalance = await checkBalance(wallet, 'ETH');
            
            // Get token balances
            const usdcBalance = await checkBalance(wallet, network.contracts.USDC_ADDRESS);
            const r2usdBalance = await checkBalance(wallet, network.contracts.R2USD_ADDRESS);
            const sr2usdBalance = await checkBalance(wallet, network.contracts.SR2USD_ADDRESS);

            console.log(chalk[COLORS.WHITE](`║ ETH: ${parseFloat(ethBalance).toFixed(6)}`));
            console.log(chalk[COLORS.WHITE](`║ USDC: ${usdcBalance}`));
            console.log(chalk[COLORS.WHITE](`║ R2USD: ${r2usdBalance}`));
            console.log(chalk[COLORS.WHITE](`║ sR2USD: ${sr2usdBalance}`));
            console.log(chalk[COLORS.CYAN]('║ -------------------------------'));
        } catch (error) {
            console.log(chalk[COLORS.RED](`║ Error getting balances: ${error.message}`));
        }
    }
    console.log(chalk[COLORS.CYAN]('╚═════════════════════════════════╝\n'));

    const menuItems = [
        `1. Swaps and Staking (Manual)`,
        `2. Auto Run All`,
        `3. Random Amount Auto Run (0.1-2 USDC)`,
        `4. Exit`
    ];

    menuItems.forEach(item => {
        console.log(chalk[COLORS.YELLOW](item));
    });
    console.log(chalk[COLORS.GREEN]('\n═══════════════════════════════════════'));

    const option = await getInput('Select an option (1-4): ');
    switch (option) {
        case '1':
            await handleSwapsAndStaking(wallets);
            break;
        case '2':
            await handleAutoRunAll(wallets);
            break;
        case '3':
            await handleRandomAmountAutoRun(wallets);
            break;
        case '4':
            console.log(chalk[COLORS.GRAY]('Exiting application...'));
            process.exit(0);
        default:
            console.log(chalk[COLORS.YELLOW]('Invalid option. Please select 1-4.'));
            await showMenu(wallets);
            break;
    }
}

// Update transaction status display
function displayTransactionStatus(wallet, network, txType, amount, hash) {
    console.log('\n' + chalk[COLORS.CYAN]('╔════════ Transaction Details ════════╗'));
    console.log(chalk[COLORS.WHITE](`║ Wallet: ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`));
    console.log(chalk[COLORS.WHITE](`║ Network: ${network.name}`));
    console.log(chalk[COLORS.WHITE](`║ Type: ${txType}`));
    console.log(chalk[COLORS.WHITE](`║ Amount: ${amount}`));
    console.log(chalk[COLORS.GREEN](`║ Hash: ${hash}`));
    console.log(chalk[COLORS.CYAN]('╚══════════════════════════════════╝\n'));
}

// Update balance display
function displayBalances(usdcBalance, r2usdBalance, sr2usdBalance) {
    console.log('\n' + chalk[COLORS.CYAN]('╔════════ Current Balances ════════╗'));
    console.log(chalk[COLORS.WHITE](`║ USDC: ${usdcBalance}`));
    console.log(chalk[COLORS.WHITE](`║ R2USD: ${r2usdBalance}`));
    console.log(chalk[COLORS.WHITE](`║ sR2USD: ${sr2usdBalance}`));
    console.log(chalk[COLORS.CYAN]('╚═════════════════════════════════╝\n'));
}

// Update progress display
function displayProgress(current, total, type) {
    const percentage = (current / total) * 100;
    const progressBar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
    console.log(chalk[COLORS.CYAN](`\r[${progressBar}] ${percentage.toFixed(1)}% | ${type} ${current}/${total}`));
}

// Update getInput function
async function getInput(prompt) {
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => {
        readline.question(chalk[COLORS.YELLOW](prompt), answer => {
            readline.close();
            resolve(answer);
        });
    });
}

// Update error display
function displayError(message) {
    console.log('\n' + chalk[COLORS.RED]('╔════════ ERROR ════════╗'));
    console.log(chalk[COLORS.RED](`║ ${message}`));
    console.log(chalk[COLORS.RED]('╚════════════════════════╝\n'));
}

// Update success display
function displaySuccess(message) {
    console.log('\n' + chalk[COLORS.GREEN]('╔════════ SUCCESS ════════╗'));
    console.log(chalk[COLORS.GREEN](`║ ${message}`));
    console.log(chalk[COLORS.GREEN]('╚══════════════════════════╝\n'));
}

// Utility functions
function colorText(text, color) {
    return chalk[color](text);
}

function isValidPrivateKey(key) {
  const cleanKey = key.startsWith('0x') ? key.slice(2) : key;
  return /^[0-9a-fA-F]{64}$/.test(cleanKey);
}

function isValidAddress(address) {
  return ethers.utils.isAddress(address) && address !== ethers.constants.AddressZero;
}

function loadProxies() {
  try {
    if (fs.existsSync('./proxies.txt')) {
      proxies = fs.readFileSync('./proxies.txt', 'utf8')
        .split('\n')
        .filter(line => line.trim().length > 0);
      log(`${colorText(`Loaded ${proxies.length} proxies from proxies.txt`, COLORS.GREEN)}`);
    } else {
      log(`${colorText('proxies.txt not found. Connecting directly.', COLORS.RED)}`);
    }
  } catch (error) {
    log(`${colorText(`Failed to load proxies: ${error.message}`, COLORS.RED)}`);
  }
}

function getPrivateKeysFromEnv() {
    const keys = [];
    if (process.env.PRIVATE_KEY) {
        keys.push(process.env.PRIVATE_KEY.trim());
    }
    Object.keys(process.env).forEach(key => {
        if (key.startsWith('PRIVATE_KEY_')) {
            keys.push(process.env[key].trim());
        }
    });
    return keys;
}

// Kahin bhi dobara let/const mat likho, sirf assign karo:
privateKeys = getPrivateKeysFromEnv();
    if (privateKeys.length === 0) {
    console.error('No valid private keys found in .env (PRIVATE_KEY or PRIVATE_KEY_*)');
      process.exit(1);
    }
console.log('Loaded private keys:', privateKeys.map(k => k.slice(0, 6) + '...' + k.slice(-4)).join(', '));

function loadPrivateKeys() {
  privateKeys = [];
  // Accept both PRIVATE_KEY and PRIVATE_KEY_1, PRIVATE_KEY_2, ...
  if (process.env.PRIVATE_KEY) {
    if (isValidPrivateKey(process.env.PRIVATE_KEY)) {
      privateKeys.push(process.env.PRIVATE_KEY.trim());
    }
  }
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('PRIVATE_KEY_')) {
      const pk = process.env[key];
      if (pk && isValidPrivateKey(pk)) {
        privateKeys.push(pk.trim());
      }
    }
  });
  if (privateKeys.length === 0) {
    console.error('No valid private keys found in .env (PRIVATE_KEY or PRIVATE_KEY_*)');
    process.exit(1);
  }
  console.log('Loaded private keys:', privateKeys.map(k => k.slice(0, 6) + '...' + k.slice(-4)).join(', '));
}

function getRandomProxy() {
  if (proxies.length === 0) return null;
  return proxies[Math.floor(Math.random() * proxies.length)];
}

function formatProxy(proxyString) {
  if (!proxyString) return null;
  let proxy = proxyString.trim();
  if (proxy.includes('://')) {
    proxy = proxy.split('://')[1];
  }
  let auth = '';
  let address = proxy;
  if (proxy.includes('@')) {
    const parts = proxy.split('@');
    auth = parts[0];
    address = parts[1];
  }
  const [host, port] = address.split(':');
  let username = '';
  let password = '';
  if (auth) {
    const authParts = auth.split(':');
    username = authParts[0];
    password = authParts.length > 1 ? authParts[1] : '';
  }
  return {
    host,
    port: parseInt(port, 10),
    auth: auth ? { username, password } : undefined,
  };
}

async function initialize() {
    console.log('>>> SYSTEM BOOT INITIATED');
    console.log('[[ R2 AUTO BOT ]] - BY HIMANSHU SAROHA');
    console.log('----------------------------------');

    if (privateKeys.length === 0) {
        console.error('No valid private keys found in .env (PRIVATE_KEY or PRIVATE_KEY_*)');
        process.exit(1);
    }

    console.log(chalk[COLORS.GREEN](`Found private key: ${privateKeys[0].slice(0, 6)}...${privateKeys[0].slice(-4)}`));

    const wallets = [];
    try {
        // Initialize for each network
        for (const network of Object.values(NETWORKS)) {
            console.log(chalk[COLORS.YELLOW](`\nInitializing ${network.name} wallet...`));
            const provider = new ethers.providers.JsonRpcProvider(network.rpcUrl);
            const wallet = new ethers.Wallet(privateKeys[0], provider);
            wallets.push({ privateKey: privateKeys[0], wallet, network });
            console.log(chalk[COLORS.GREEN](`${network.name} wallet initialized: ${wallet.address}`));
        }
      } catch (error) {
        console.error(chalk[COLORS.RED](`Error initializing wallets: ${error.message}`));
        process.exit(1);
    }

    if (wallets.length === 0) {
        console.error(chalk[COLORS.RED]('No wallets initialized. Exiting.'));
        process.exit(1);
    }

    console.log(chalk[COLORS.GREEN](`\nSuccessfully initialized ${wallets.length} wallets`));
    return wallets;
}

async function initializeWallet(privateKey, network) {
    try {
        const provider = new ethers.providers.JsonRpcProvider(network.rpcUrl);
        const wallet = new ethers.Wallet(privateKey, provider);
        return wallet;
  } catch (error) {
        throw new Error(`Failed to initialize wallet for ${network.name}: ${error.message}`);
  }
}

async function checkBalance(wallet, tokenAddress) {
  try {
    if (tokenAddress === 'ETH') {
      const balance = await wallet.provider.getBalance(wallet.address);
      return ethers.utils.formatEther(balance);
    } else {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
      const [balance, decimals] = await Promise.all([
        tokenContract.balanceOf(wallet.address),
        tokenContract.decimals()
      ]);
    return ethers.utils.formatUnits(balance, decimals);
    }
  } catch (error) {
    console.log(chalk[COLORS.RED](`Error checking balance on ${network.name}: ${error.message}`));
    return '0.000000';
  }
}

async function checkEthBalance(wallet) {
  try {
    const balance = await wallet.provider.getBalance(wallet.address);
    return ethers.utils.formatEther(balance);
  } catch (error) {
    log(`${colorText(`Failed to check ETH balance: ${error.message}`, COLORS.RED)}`);
    return '0';
  }
}

async function updateWalletInfo(wallets, network) {
  const walletInfo = [];
  for (const wallet of wallets) {
    const ethBalance = await checkEthBalance(wallet);
    const usdcBalance = isValidAddress(network.contracts.USDC_ADDRESS)
      ? await checkBalance(wallet, network.contracts.USDC_ADDRESS)
      : 'N/A';
    const r2usdBalance = isValidAddress(network.contracts.R2USD_ADDRESS)
      ? await checkBalance(wallet, network.contracts.R2USD_ADDRESS)
      : 'N/A';
    const sr2usdBalance = isValidAddress(network.contracts.SR2USD_ADDRESS)
      ? await checkBalance(wallet, network.contracts.SR2USD_ADDRESS)
      : 'N/A';
    walletInfo.push(
      `WALLET: ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}\n` +
      `ETH: ${parseFloat(ethBalance).toFixed(4)}\n` +
      `USDC: ${usdcBalance === 'N/A' ? 'N/A' : parseFloat(usdcBalance).toFixed(2)}\n` +
      `R2USD: ${r2usdBalance === 'N/A' ? 'N/A' : parseFloat(r2usdBalance).toFixed(2)}\n` +
      `sR2USD: ${sr2usdBalance === 'N/A' ? 'N/A' : parseFloat(sr2usdBalance).toFixed(2)}\n`
    );
  }
  log(
    '{center}{bold}SYSTEM INFO{/bold}{/center}\n\n' +
    walletInfo.join('---\n') +
    `{green-fg}STATUS: ONLINE{/green-fg}\n` +
    `{green-fg}NETWORK: ${network.name} (chainId: ${network.chainId}){/green-fg}`
  );
}

async function estimateGas(wallet, tx) {
  try {
    let gasEstimate;
    try {
        gasEstimate = await wallet.estimateGas(tx);
        console.log(chalk[COLORS.YELLOW](`Estimated gas: ${gasEstimate.toString()}`));
    } catch (err) {
        console.log(chalk[COLORS.RED]('Gas estimate error:', err.message));
        gasEstimate = ethers.BigNumber.from('200000');
    }
    return gasEstimate.mul(120).div(100);
  } catch (error) {
    log(`${colorText(`Failed to estimate gas: ${error.message}`, COLORS.RED)}`);
    return ethers.BigNumber.from('200000');
  }
}

async function approveToken(wallet, tokenAddress, spenderAddress, amount, network) {
  try {
    if (!isValidAddress(tokenAddress) || !isValidAddress(spenderAddress)) {
      log(`${colorText(`Invalid token (${tokenAddress}) or spender (${spenderAddress}) address. Skipping approval.`, COLORS.RED)}`);
      return false;
    }
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
    const decimals = await tokenContract.decimals();
    const currentAllowance = await tokenContract.allowance(wallet.address, spenderAddress);
    const amountInWei = ethers.utils.parseUnits(amount.toString(), decimals);
    if (currentAllowance.gte(amountInWei)) {
      log(`${colorText('Sufficient allowance already exists', COLORS.GRAY)}`);
      return true;
    }
    log(`${colorText(`Approving ${amount} tokens for spending...`, COLORS.MAGENTA)}`);
    const tx = await tokenContract.approve(spenderAddress, amountInWei, { gasLimit: 100000 });
    log(`${colorText(`Approval transaction sent: ${tx.hash}`, COLORS.GREEN)}`);
    log(`${colorText(`Explorer: ${network.explorer}/tx/${tx.hash}`, COLORS.GRAY)}`);
    const stopSpinner = showSpinner(
      'Waiting for approval confirmation...',
      `Approval confirmed!`,
      60
    );
    await tx.wait();
    stopSpinner();
    log(`${colorText('Approval completed', COLORS.CYAN)}`);
    await updateWalletInfo(wallets, network);
    return true;
  } catch (error) {
    log(`${colorText(`Failed to approve token: ${error.message}`, COLORS.RED)}`);
    return false;
  }
}

async function estimateGasFees(provider) {
  try {
    const feeData = await provider.getFeeData();
    return {
      maxFeePerGas: feeData.maxFeePerGas || ethers.utils.parseUnits('50', 'gwei'),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.utils.parseUnits('2', 'gwei'),
    };
  } catch (error) {
    log(`${colorText(`Failed to estimate gas fees, using defaults: ${error.message}`, COLORS.YELLOW)}`);
    return {
      maxFeePerGas: ethers.utils.parseUnits('50', 'gwei'),
      maxPriorityFeePerGas: ethers.utils.parseUnits('2', 'gwei'),
    };
  }
}

// Add consistent delay between transactions
async function delay(min = 5, max = 10) {
    const seconds = Math.floor(Math.random() * (max - min + 1)) + min;
    log(`${colorText(`Waiting ${seconds} seconds before next transaction...`, COLORS.GRAY)}`);
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

// Add function to check if enough ETH for gas
async function hasEnoughETHForGas(wallet, gasLimit, gasFees) {
    try {
        const ethBalance = await wallet.getBalance();
        const estimatedGasCost = gasLimit.mul(gasFees.maxFeePerGas);
        
        // Format balances for logging
        const ethBalanceInEther = ethers.utils.formatEther(ethBalance);
        const gasCostInEther = ethers.utils.formatEther(estimatedGasCost);
        
        console.log(chalk[COLORS.WHITE](`Current ETH balance: ${ethBalanceInEther} ETH`));
        console.log(chalk[COLORS.WHITE](`Estimated gas cost: ${gasCostInEther} ETH`));

        if (ethBalance.lt(estimatedGasCost)) {
            console.log(chalk[COLORS.RED](`Insufficient ETH for gas. Need ${gasCostInEther} ETH, have ${ethBalanceInEther} ETH`));
            return false;
        }
        return true;
    } catch (error) {
        console.log(chalk[COLORS.RED](`Error checking ETH balance: ${error.message}`));
            return false;
        }
}

// Add transaction lock to prevent duplicate transactions
let isTransactionInProgress = false;

// Update handleRandomAmountAutoRun function
async function handleRandomAmountAutoRun(wallets) {
    // --- Network selection ---
    const networkList = Object.values(NETWORKS);
    log(`${colorText('Available networks:', COLORS.WHITE)}`);
    networkList.forEach((network, index) => {
        log(`${colorText(`${index + 1}. ${network.name}`, COLORS.YELLOW)}`);
    });
    const input = await getInput('Select network number (or "all" for all networks): ');
    let selectedNetworks;
    if (input.toLowerCase() === 'all') {
        selectedNetworks = networkList;
    } else {
        const index = parseInt(input) - 1;
        if (isNaN(index) || index < 0 || index >= networkList.length) {
            log(`${colorText('Invalid selection. Using first network.', COLORS.YELLOW)}`);
            selectedNetworks = [networkList[0]];
        } else {
            selectedNetworks = [networkList[index]];
        }
    }

    // --- Number of transactions ---
    const numTxs = await getInput('Enter number of transactions per network: ');
    const parsedNumTxs = parseInt(numTxs);
    if (isNaN(parsedNumTxs) || parsedNumTxs <= 0) {
        log(`${colorText('Invalid number', COLORS.RED)}`);
        return;
    }

    // --- Rest of your code, loop over selectedNetworks ---
    for (const network of selectedNetworks) {
        log(chalk[COLORS.CYAN](`\nProcessing ${network.name}...`));
        
        for (const walletObj of wallets) {
            const wallet = await initializeWallet(walletObj.privateKey, network);
            console.log(chalk[COLORS.WHITE](`Using wallet: ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`));

            for (let i = 1; i <= parsedNumTxs; i++) {
                console.log(chalk[COLORS.YELLOW](`\nTransaction ${i}/${parsedNumTxs} on ${network.name}`));

                // Do USDC to R2USD swap
                console.log(chalk[COLORS.CYAN]('Performing USDC to R2USD swap...'));
                await swapUSDCtoR2USD(wallet, null, network);
                await delay(10);

                // Do R2USD to USDC swap
                console.log(chalk[COLORS.CYAN]('Performing R2USD to USDC swap...'));
                await swapR2USDtoUSDC(wallet, null, network);
                await delay(10);
            }
        }
    }

    console.log(chalk[COLORS.GREEN]('\nAll transactions completed!'));
    await delay(5);
    await showMenu(wallets);
}

// Update handleManualMode function
async function handleManualMode(wallets) {
    try {
        console.clear();
        console.log(chalk[COLORS.CYAN]('=== Manual Mode ==='));

        // Select network
        console.log(chalk[COLORS.YELLOW]('\nAvailable Networks:'));
        Object.values(NETWORKS).forEach((network, index) => {
            console.log(chalk[COLORS.WHITE](`${index + 1}. ${network.name}`));
        });
        
        const networkChoice = await getInput('\nSelect network (number): ');
        const network = Object.values(NETWORKS)[parseInt(networkChoice) - 1];
        
        if (!network) {
            console.log(chalk[COLORS.RED]('Invalid network selection'));
            return;
        }

        // Select action
        console.log(chalk[COLORS.YELLOW]('\nAvailable Actions:'));
        console.log(chalk[COLORS.WHITE]('1. USDC to R2USD Swap'));
        console.log(chalk[COLORS.WHITE]('2. R2USD to USDC Swap'));
        console.log(chalk[COLORS.WHITE]('3. Back to Main Menu'));

        const action = await getInput('\nSelect action (1-3): ');
        if (action === '3') {
            await showMenu(wallets);
            return;
        }

        // Get amount
        const amount = await getInput('Enter amount: ');
        if (isNaN(amount) || parseFloat(amount) <= 0) {
            console.log(chalk[COLORS.RED]('Invalid amount'));
            return;
        }

        // Execute transaction
        for (const walletObj of wallets) {
            const wallet = await initializeWallet(walletObj.privateKey, network);
            
            switch (action) {
                case '1':
                    await swapUSDCtoR2USD(wallet, amount, network);
                    break;
                case '2':
                    await swapR2USDtoUSDC(wallet, amount, network);
                    break;
            }
        }

        await delay(5);
        await showMenu(wallets);

    } catch (error) {
        console.log(chalk[COLORS.RED](`Error: ${error.message}`));
        await delay(5);
        await showMenu(wallets);
    }
}

// Update transaction functions to use better progress display
async function swapUSDCtoR2USD(wallet, amount, network) {
    try {
        if (!amount) {
            amount = (Math.random() * (2 - 0.1) + 0.1).toFixed(6);
        }
        const amountInWei = ethers.utils.parseUnits(amount.toString(), 6);

        // Colorful output for user
        console.log(chalk[COLORS.CYAN](`Random amount: ${amount} USDC`));
        console.log(chalk[COLORS.YELLOW](`amountInWei: ${amountInWei.toString()}`));

        const ethBalance = await wallet.getBalance();
        const usdcContract = new ethers.Contract(network.contracts.USDC_ADDRESS, ERC20_ABI, wallet);
        const usdcBalance = await usdcContract.balanceOf(wallet.address);

        console.log(chalk[COLORS.GREEN](`Current ETH balance: ${ethers.utils.formatEther(ethBalance)}`));
        console.log(chalk[COLORS.GREEN](`Current USDC balance: ${ethers.utils.formatUnits(usdcBalance, 6)}`));
        console.log(chalk[COLORS.MAGENTA](`Amount to swap: ${amount} USDC (${amountInWei.toString()} wei)`));

        // 3. Approve if needed
        const approved = await approveToken(wallet, network.contracts.USDC_ADDRESS, network.contracts.USDC_TO_R2USD_CONTRACT, amount, network);
        if (!approved) return false;

        // 4. Prepare data
        if (!network.contracts.USDC_TO_R2USD_METHOD_ID) {
            throw new Error('USDC_TO_R2USD_METHOD_ID is undefined for this network!');
        }
        const data = ethers.utils.hexConcat([
            network.contracts.USDC_TO_R2USD_METHOD_ID,
            ethers.utils.defaultAbiCoder.encode(
                ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
                [wallet.address, amountInWei, 0, 0, 0, 0, 0]
            ),
        ]);

        // 5. Estimate gas
        const gasFees = await estimateGasFees(wallet.provider);
        const tx = {
            to: network.contracts.USDC_TO_R2USD_CONTRACT,
            data: data,
            ...gasFees,
        };
        const gasEstimate = await estimateGas(wallet, tx);
        console.log(`Estimated gas: ${gasEstimate.toString()}`);

        // 6. Send transaction
        const signedTx = await wallet.sendTransaction({
            ...tx,
            gasLimit: gasEstimate,
        });
        console.log(`Transaction sent: ${signedTx.hash}`);
        await signedTx.wait();
        console.log('Swap completed!');
        return true;
    } catch (error) {
        console.log(chalk[COLORS.RED]('Error in swapUSDCtoR2USD:', error));
        throw error;
    }
}

// Similar updates for R2USD to USDC swap and stakeR2USD functions...

// UI helper functions
function showBanner() {
  const banner = [
    '>>> SYSTEM BOOT INITIATED',
    '[[ R2 AUTO BOT ]] - BY HIMANSHU SAROHA',
    '----------------------------------',
  ];
  banner.forEach((line, index) => {
    setTimeout(() => {
      log(line, index === 1 ? COLORS.CYAN : COLORS.GREEN);
    }, index * 150);
  });
}

async function selectWallet(wallets) {
  if (wallets.length === 1) {
    log(`${colorText(`Using wallet: ${wallets[0].wallet.address.slice(0, 6)}...${wallets[0].wallet.address.slice(-4)}`, COLORS.WHITE)}`);
    return wallets[0];
  }
  log(`${colorText('Available wallets:', COLORS.WHITE)}`);
  wallets.forEach((walletObj, index) => {
    log(`${colorText(`${index + 1}. ${walletObj.wallet.address.slice(0, 6)}...${walletObj.wallet.address.slice(-4)}`, COLORS.YELLOW)}`);
  });
  const input = await getInput('Select wallet number (or "all" for all wallets): ');
  if (input.toLowerCase() === 'all') {
    return wallets;
  }
  const index = parseInt(input) - 1;
  if (isNaN(index) || index < 0 || index >= wallets.length) {
    log(`${colorText('Invalid selection. Using first wallet.', COLORS.YELLOW)}`);
    return wallets[0];
  }
  log(`${colorText(`Using wallet: ${wallets[index].wallet.address.slice(0, 6)}...${wallets[index].wallet.address.slice(-4)}`, COLORS.WHITE)}`);
  return wallets[index];
}

async function selectNetwork() {
  const networkList = Object.values(NETWORKS);
  if (networkList.length === 1) {
    log(`${colorText(`Using network: ${networkList[0].name}`, COLORS.WHITE)}`);
    return [networkList[0]];
  }
  log(`${colorText('Available networks:', COLORS.WHITE)}`);
  networkList.forEach((network, index) => {
    log(`${colorText(`${index + 1}. ${network.name}`, COLORS.YELLOW)}`);
  });
  const input = await getInput('Select network number (or "all" for all networks): ');
  if (input.toLowerCase() === 'all') {
    return networkList;
  }
  const index = parseInt(input) - 1;
  if (isNaN(index) || index < 0 || index >= networkList.length) {
    log(`${colorText('Invalid selection. Using first network.', COLORS.YELLOW)}`);
    return [networkList[0]];
  }
  log(`${colorText(`Using network: ${networkList[index].name}`, COLORS.WHITE)}`);
  return [networkList[index]];
}

async function handleSwapsAndStaking(wallets) {
  try {
        console.clear();
        console.log(chalk[COLORS.GREEN]('╔════════ Manual Swaps and Staking ════════╗'));
        
        // Select wallet if multiple
    const selectedWallets = wallets.length === 1 ? wallets[0] : await selectWallet(wallets);
    const isAllWallets = Array.isArray(selectedWallets);
    const walletList = isAllWallets ? selectedWallets : [selectedWallets];

        // Select network
    const selectedNetworks = await selectNetwork();
    const isAllNetworks = selectedNetworks.length > 1;

        console.log(chalk[COLORS.CYAN]('\nSelect Action:'));
        console.log(chalk[COLORS.YELLOW]('1. USDC to R2USD Swap'));
        console.log(chalk[COLORS.YELLOW]('2. R2USD to USDC Swap'));
        console.log(chalk[COLORS.YELLOW]('3. Stake R2USD'));
        console.log(chalk[COLORS.YELLOW]('4. Back to Main Menu'));

        const action = await getInput('\nSelect action (1-4): ');
        if (action === '4') {
      await showMenu(wallets);
      return;
    }

        // Get amount from user
        const amount = await getInput('Enter amount: ');
        if (isNaN(amount) || parseFloat(amount) <= 0) {
            console.log(chalk[COLORS.RED]('Invalid amount. Please enter a positive number.'));
            await handleSwapsAndStaking(wallets);
            return;
        }

        // Get number of transactions
        const numTxs = await getInput('Enter number of transactions: ');
    const parsedNumTxs = parseInt(numTxs);
    if (isNaN(parsedNumTxs) || parsedNumTxs <= 0) {
            console.log(chalk[COLORS.RED]('Invalid number. Enter a positive integer.'));
      await handleSwapsAndStaking(wallets);
      return;
    }

      for (const network of selectedNetworks) {
            console.log(chalk[COLORS.CYAN](`\nProcessing network: ${network.name}`));
            
        for (const walletObj of walletList) {
          let wallet = walletObj.wallet;
          if (walletObj.network.name !== network.name) {
            const result = await initializeWallet(walletObj.privateKey, network);
            wallet = result.wallet;
          }

                console.log(chalk[COLORS.WHITE](`Processing wallet: ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`));

          for (let i = 1; i <= parsedNumTxs; i++) {
                    try {
                        let success = false;
                        switch (action) {
                            case '1':
                                console.log(chalk[COLORS.YELLOW](`\nTransaction ${i}/${parsedNumTxs}: USDC to R2USD swap`));
                                success = await swapUSDCtoR2USD(wallet, amount, network);
                                break;
                            case '2':
                                console.log(chalk[COLORS.YELLOW](`\nTransaction ${i}/${parsedNumTxs}: R2USD to USDC swap`));
                                success = await swapR2USDtoUSDC(wallet, amount, network);
                                break;
                            case '3':
                                console.log(chalk[COLORS.YELLOW](`\nTransaction ${i}/${parsedNumTxs}: Stake R2USD`));
                                success = await stakeR2USD(wallet, amount, network);
                                break;
                        }

                        if (success) {
                            console.log(chalk[COLORS.GREEN](`Transaction ${i} completed successfully!`));
                        } else {
                            console.log(chalk[COLORS.RED](`Transaction ${i} failed.`));
                        }

                        // Add delay between transactions
                        if (i < parsedNumTxs) {
                            const delay = 5000; // 5 seconds
                            console.log(chalk[COLORS.GRAY](`Waiting ${delay/1000} seconds before next transaction...`));
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }

                    } catch (error) {
                        console.log(chalk[COLORS.RED](`Error in transaction ${i}: ${error.message}`));
                        continue;
                    }
                }
            }
        }

        console.log(chalk[COLORS.GREEN]('\nAll transactions completed!'));
        await new Promise(resolve => setTimeout(resolve, 3000));
        await showMenu(wallets);

  } catch (error) {
        console.log(chalk[COLORS.RED](`Error: ${error.message}`));
    await showMenu(wallets);
  }
}

async function handleAutoRunAll(wallets) {
  try {
    log(`${colorText('=== Auto Run All Configuration ===', COLORS.CYAN)}`);
    const numTxs = await getInput('Enter number of transactions: ');
    const parsedNumTxs = parseInt(numTxs);
    if (isNaN(parsedNumTxs) || parsedNumTxs <= 0) {
      log(`${colorText('Invalid number. Enter a positive integer.', COLORS.RED)}`);
      await showMenu(wallets);
      return;
    }
    log(`${colorText('=================================', COLORS.CYAN)}`);

    const runAutoCycle = async () => {
      const networkList = Object.values(NETWORKS);
      for (const network of networkList) {
        log(`${colorText(`Processing network: ${network.name}`, COLORS.CYAN)}`);
        if (network.name !== 'Sepolia') {
          log(`${colorText(`Warning: Staking addresses may be Sepolia-specific. Verify STAKE_R2USD_CONTRACT (${network.contracts.STAKE_R2USD_CONTRACT}) on ${network.explorer}.`, COLORS.YELLOW)}`);
        }
        for (const walletObj of wallets) {
          let wallet;
          try {
            const result = await initializeWallet(walletObj.privateKey, network);
            wallet = result.wallet;
          } catch (error) {
            log(`${colorText(`Skipping wallet ${walletObj.wallet.address.slice(0, 6)}... on ${network.name} due to initialization error`, COLORS.RED)}`);
            continue;
          }
          log(`${colorText(`Processing wallet: ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)} on ${network.name}`, COLORS.WHITE)}`);

          log(`${colorText(`Starting ${parsedNumTxs} USDC to R2USD swaps`, COLORS.CYAN)}`);
          for (let i = 1; i <= parsedNumTxs; i++) {
            log(`${colorText(`Swap ${i}/${parsedNumTxs}: USDC to R2USD`, COLORS.YELLOW)}`);
            const success = await swapUSDCtoR2USD(wallet, null, network);
            log(
              `${colorText(`Swap ${i} ${success ? 'completed!' : 'failed.'}`, success ? COLORS.GREEN : COLORS.RED)}`
            );
            if (!success) break;
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          log(`${colorText(`Starting ${parsedNumTxs} R2USD to USDC swaps`, COLORS.CYAN)}`);
          for (let i = 1; i <= parsedNumTxs; i++) {
            log(`${colorText(`Swap ${i}/${parsedNumTxs}: R2USD to USDC`, COLORS.YELLOW)}`);
            const success = await swapR2USDtoUSDC(wallet, null, network);
            log(
              `${colorText(`Swap ${i} ${success ? 'completed!' : 'failed.'}`, success ? COLORS.GREEN : COLORS.RED)}`
            );
            if (!success) break;
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          log(`${colorText(`Starting ${parsedNumTxs} R2USD to sR2USD stakes`, COLORS.CYAN)}`);
          for (let i = 1; i <= parsedNumTxs; i++) {
            log(`${colorText(`Stake ${i}/${parsedNumTxs}: R2USD to sR2USD`, COLORS.YELLOW)}`);
            const success = await stakeR2USD(wallet, null, network);
            log(
              `${colorText(`Stake ${i} ${success ? 'completed!' : 'failed.'}`, success ? COLORS.GREEN : COLORS.RED)}`
            );
            if (!success) break;
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          log(`${colorText(`Completed all tasks for ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)} on ${network.name}`, COLORS.GREEN)}`);
        }
      }

      log(`${colorText(`All networks processed! Pausing for 24 hours...`, COLORS.YELLOW)}`);
      await new Promise(resolve => setTimeout(resolve, 24 * 60 * 60 * 1000));
      log(`${colorText(`Restarting auto-run cycle...`, COLORS.CYAN)}`);
      await runAutoCycle();
    };

    await runAutoCycle();
  } catch (error) {
    log(`${colorText(`Error in auto-run cycle: ${error.message}`, COLORS.RED)}`);
    await showMenu(wallets);
  }
}

// Add stakeR2USD function
async function stakeR2USD(wallet, amount, network) {
    try {
        // Set random amount if not provided
        if (!amount) {
            amount = (Math.random() * (2 - 0.1) + 0.1).toFixed(6);
        }
        const amountInWei = ethers.utils.parseUnits(amount.toString(), 6);
        
        // Check R2USD balance
        const r2usdContract = new ethers.Contract(network.contracts.R2USD_ADDRESS, ERC20_ABI, wallet);
        const balance = await r2usdContract.balanceOf(wallet.address);
        
        if (amountInWei.gt(balance)) {
            console.log(chalk[COLORS.RED](`Insufficient R2USD balance for staking. Have: ${ethers.utils.formatUnits(balance, 6)}, Need: ${amount}`));
            return false;
        }

        // Approve staking contract
        console.log(chalk[COLORS.YELLOW](`Approving ${amount} R2USD for staking...`));
        const approved = await approveToken(
            wallet,
            network.contracts.R2USD_ADDRESS,
            network.contracts.STAKE_R2USD_CONTRACT,
            amount,
            network
        );

        if (!approved) {
            console.log(chalk[COLORS.RED]('Approval failed'));
            return false;
        }

        // Prepare staking transaction
        console.log(chalk[COLORS.YELLOW](`Preparing to stake ${amount} R2USD...`));
        
        let data;
        if (network.name === 'Sepolia' || network.name === 'Plume Testnet') {
            data = network.contracts.STAKE_R2USD_METHOD_ID +
                amountInWei.toHexString().slice(2).padStart(64, '0') +
                '0'.repeat(576);
        } else {
            const stakeContract = new ethers.Contract(network.contracts.STAKE_R2USD_CONTRACT, STAKE_ABI, wallet);
            data = stakeContract.interface.encodeFunctionData('stake', [amountInWei]);
        }

        // Get gas estimate
        const gasFees = await estimateGasFees(wallet.provider);
        const tx = {
            to: network.contracts.STAKE_R2USD_CONTRACT,
            data: data,
            ...gasFees,
        };

        const gasLimit = await estimateGas(wallet, tx);
        console.log(chalk[COLORS.GRAY](`Estimated gas limit: ${gasLimit.toString()}`));

        // Execute staking transaction
        console.log(chalk[COLORS.YELLOW](`Staking ${amount} R2USD...`));
        const signedTx = await wallet.sendTransaction({
            ...tx,
            gasLimit: gasLimit.mul(120).div(100), // Add 20% buffer to gas limit
        });

        console.log(chalk[COLORS.GREEN](`Transaction sent: ${signedTx.hash}`));
        console.log(chalk[COLORS.GRAY](`Explorer: ${network.explorer}/tx/${signedTx.hash}`));

        // Wait for transaction confirmation
        console.log(chalk[COLORS.YELLOW]('Waiting for confirmation...'));
        const receipt = await signedTx.wait();

        if (receipt.status === 1) {
            // Check new balances
            const newR2USDBalance = await checkBalance(wallet, network.contracts.R2USD_ADDRESS);
            const newSR2USDBalance = await checkBalance(wallet, network.contracts.SR2USD_ADDRESS);
            
            console.log(chalk[COLORS.GREEN]('Staking successful!'));
            console.log(chalk[COLORS.WHITE](`New R2USD balance: ${newR2USDBalance}`));
            console.log(chalk[COLORS.WHITE](`New sR2USD balance: ${newSR2USDBalance}`));
            
            return true;
        } else {
            console.log(chalk[COLORS.RED]('Transaction failed'));
            return false;
        }

    } catch (error) {
        console.log(chalk[COLORS.RED](`Staking error: ${error.message}`));
        return false;
  }
}

async function swapR2USDtoUSDC(wallet, amount, network) {
    try {
        if (!amount) {
            amount = (Math.random() * (2 - 0.1) + 0.1).toFixed(6);
        }
        const amountInWei = ethers.utils.parseUnits(amount.toString(), 6);

        console.log(chalk[COLORS.CYAN](`Random amount: ${amount} R2USD`));
        console.log(chalk[COLORS.YELLOW](`amountInWei: ${amountInWei.toString()}`));

        const ethBalance = await wallet.getBalance();
        const r2usdContract = new ethers.Contract(network.contracts.R2USD_ADDRESS, ERC20_ABI, wallet);
        const r2usdBalance = await r2usdContract.balanceOf(wallet.address);
        const currentBalance = ethers.utils.formatUnits(r2usdBalance, 6);
        
        console.log(chalk[COLORS.GREEN](`Current ETH balance: ${ethers.utils.formatEther(ethBalance)}`));
        console.log(chalk[COLORS.GREEN](`Current R2USD balance: ${currentBalance}`));
        console.log(chalk[COLORS.MAGENTA](`Amount to swap: ${amount} R2USD (${amountInWei.toString()} wei)`));
        
        if (amountInWei.gt(r2usdBalance)) {
            console.log(chalk[COLORS.RED](`Insufficient R2USD balance. Have: ${currentBalance}, Need: ${amount}`));
            return false;
        }

        // Get gas estimate and check ETH balance
        const gasFees = await estimateGasFees(wallet.provider);
        const gasLimit = ethers.BigNumber.from('200000'); // Base gas limit
        
        // Check if enough ETH for gas
        const hasEnoughETH = await hasEnoughETHForGas(wallet, gasLimit, gasFees);
        if (!hasEnoughETH) {
            return false;
        }

        // Approve R2USD spending
        console.log(chalk[COLORS.YELLOW](`Approving ${amount} R2USD for swap...`));
        const approved = await approveToken(
            wallet,
            network.contracts.R2USD_ADDRESS,
            network.contracts.R2USD_TO_USDC_CONTRACT,
            amount,
            network
        );

        if (!approved) {
            console.log(chalk[COLORS.RED]('R2USD approval failed'));
            return false;
        }

        // Prepare swap transaction
        console.log(chalk[COLORS.YELLOW](`Preparing to swap ${amount} R2USD to USDC...`));
        
        let data;
        if (network.name === 'Sepolia' || network.name === 'Plume Testnet') {
            data = network.contracts.R2USD_TO_USDC_METHOD_ID +
                amountInWei.toHexString().slice(2).padStart(64, '0') +
                '0'.repeat(576);
        } else {
            const swapContract = new ethers.Contract(network.contracts.R2USD_TO_USDC_CONTRACT, SWAP_ABI, wallet);
            data = swapContract.interface.encodeFunctionData('exchange', [0, 1, amountInWei, 0]);
        }

        // Execute swap transaction with lower gas price
        const tx = {
            to: network.contracts.R2USD_TO_USDC_CONTRACT,
            data: data,
            maxFeePerGas: ethers.utils.parseUnits('20', 'gwei'), // Lower gas price
            maxPriorityFeePerGas: ethers.utils.parseUnits('1.5', 'gwei'), // Lower priority fee
            gasLimit: gasLimit
        };

        console.log(chalk[COLORS.YELLOW](`Swapping ${amount} R2USD to USDC...`));
        const signedTx = await wallet.sendTransaction(tx);

        console.log(chalk[COLORS.GREEN](`Transaction sent: ${signedTx.hash}`));
        console.log(chalk[COLORS.GRAY](`Explorer: ${network.explorer}/tx/${signedTx.hash}`));

        // Wait for confirmation
        console.log(chalk[COLORS.YELLOW]('Waiting for confirmation...'));
        const receipt = await signedTx.wait();

        if (receipt.status === 1) {
            const newR2USDBalance = await checkBalance(wallet, network.contracts.R2USD_ADDRESS);
            const newUSDCBalance = await checkBalance(wallet, network.contracts.USDC_ADDRESS);
            
            console.log(chalk[COLORS.GREEN]('Swap successful!'));
            console.log(chalk[COLORS.WHITE](`New R2USD balance: ${newR2USDBalance}`));
            console.log(chalk[COLORS.WHITE](`New USDC balance: ${newUSDCBalance}`));
            
            return true;
        } else {
            console.log(chalk[COLORS.RED]('Transaction failed'));
            return false;
        }

    } catch (error) {
        console.log(chalk[COLORS.RED](`R2USD to USDC swap error: ${error.message}`));
        return false;
    }
}

async function main() {
  try {
    await new Promise(resolve => {
      showBanner();
      setTimeout(resolve, 450);
    });

    loadProxies();
    loadPrivateKeys();
    const wallets = await initialize();
    await updateWalletInfo(wallets.map(w => w.wallet), wallets[0].network);
    await showMenu(wallets);
  } catch (error) {
    log(`${colorText(`Fatal error: ${error.message}`, COLORS.RED)}`);
    process.exit(1);
  }
}

main();

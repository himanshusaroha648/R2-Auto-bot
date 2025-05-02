require('dotenv').config();
const fs = require('fs');
const { ethers } = require('ethers');
const { HttpsProxyAgent } = require('https-proxy-agent');
const chalk = require('chalk');

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
    rpcUrls: [
      'https://testnet-rpc.plumenetwork.xyz',
      'https://rpc.testnet.plumenetwork.xyz',
    ],
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
        try {
            const wallet = walletObj.wallet;
            const network = walletObj.network;
            
            // Get ETH balance first
            const ethBalance = await checkBalance(wallet, 'ETH');
            
            // Get token balances
            const usdcBalance = await checkBalance(wallet, network.contracts.USDC_ADDRESS);
            const r2usdBalance = await checkBalance(wallet, network.contracts.R2USD_ADDRESS);
            const sr2usdBalance = await checkBalance(wallet, network.contracts.SR2USD_ADDRESS);

            console.log(chalk[COLORS.WHITE](`║ Wallet: ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`));
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

function loadPrivateKeys() {
  try {
    const envKeys = Object.keys(process.env).filter(key => key.startsWith('PRIVATE_KEY_'));
    if (envKeys.length > 0) {
      privateKeys = envKeys
        .map(key => process.env[key])
        .filter(key => key && key.trim().length > 0)
        .filter(key => {
          if (!isValidPrivateKey(key)) {
            log(`${colorText(`Invalid private key format for ${key.slice(0, 6)}...: must be 64 hex characters`, COLORS.RED)}`);
            return false;
          }
          return true;
        });
    }
    if (privateKeys.length === 0) {
      log(`${colorText('No valid private keys found in .env (PRIVATE_KEY_*)', COLORS.RED)}`);
      process.exit(1);
    }
    log(`${colorText(`Loaded ${privateKeys.length} private key(s) from .env`, COLORS.GREEN)}`);
  } catch (error) {
    log(`${colorText(`Failed to load private keys from .env: ${error.message}`, COLORS.RED)}`);
    process.exit(1);
  }
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

async function initializeWallet(privateKey, network) {
  try {
    const stopSpinner = showSpinner(
      `Connecting to ${network.name} network...`,
      `Connected to ${network.name} network!`,
      60
    );
    let provider;
    const proxyString = getRandomProxy();
    const rpcUrls = network.rpcUrls || [network.rpcUrl];
    let lastError = null;

    for (const rpcUrl of rpcUrls) {
      try {
        if (proxyString) {
          const proxyConfig = formatProxy(proxyString);
          log(`${colorText(`Using proxy: ${proxyString} with RPC: ${rpcUrl}`, COLORS.GRAY)}`);
          const agent = new HttpsProxyAgent({
            host: proxyConfig.host,
            port: proxyConfig.port,
            auth: proxyConfig.auth ? `${proxyConfig.auth.username}:${proxyConfig.auth.password}` : undefined,
          });
          provider = new ethers.providers.JsonRpcProvider(
            {
              url: rpcUrl,
              agent,
            },
            { name: network.name, chainId: network.chainId }
          );
        } else {
          log(`${colorText(`Using RPC: ${rpcUrl}`, COLORS.GRAY)}`);
          provider = new ethers.providers.JsonRpcProvider(
            rpcUrl,
            { name: network.name, chainId: network.chainId }
          );
        }
        await provider.getNetwork();
        log(`${colorText(`Connected to RPC: ${rpcUrl}`, COLORS.GREEN)}`);
        stopSpinner();
        const wallet = new ethers.Wallet(privateKey, provider);
        log(`${colorText(`Wallet initialized on ${network.name}: ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`, COLORS.WHITE)}`);
        return { provider, wallet };
      } catch (error) {
        lastError = error;
        log(`${colorText(`Failed to connect to RPC ${rpcUrl}: ${error.message}`, COLORS.YELLOW)}`);
        continue;
      }
    }
    stopSpinner();
    throw new Error(`All RPCs failed for ${network.name}: ${lastError.message}`);
  } catch (error) {
    log(`${colorText(`Failed to initialize wallet for key ${privateKey.slice(0, 6)}... on ${network.name}: ${error.message}`, COLORS.RED)}`);
    throw error;
  }
}

async function checkBalance(wallet, tokenAddress) {
  try {
        if (tokenAddress === 'ETH') {
            // Get native ETH balance
            const balance = await wallet.getBalance();
            return ethers.utils.formatEther(balance);
        } else {
            // Get token balance
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
    const balance = await tokenContract.balanceOf(wallet.address);
    const decimals = await tokenContract.decimals();
            const formattedBalance = ethers.utils.formatUnits(balance, decimals);
            return parseFloat(formattedBalance).toFixed(6);
        }
  } catch (error) {
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
    const estimatedGas = await wallet.estimateGas(tx);
    return estimatedGas.mul(120).div(100);
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
    await updateWalletInfo([wallet], network);
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

// Update handleRandomAmountAutoRun function
async function handleRandomAmountAutoRun(wallets) {
    try {
        log(`${colorText('=== Random Amount Auto Run Configuration ===', COLORS.CYAN)}`);
        const numTxs = await getInput('Enter number of transactions: ');
        const parsedNumTxs = parseInt(numTxs);
        if (isNaN(parsedNumTxs) || parsedNumTxs <= 0) {
            log(`${colorText('Invalid number. Enter a positive integer.', COLORS.RED)}`);
            await showMenu(wallets);
            return;
        }

        const runRandomCycle = async () => {
            for (const network of Object.values(NETWORKS)) {
                for (const walletObj of wallets) {
                    let wallet;
                    try {
                        const result = await initializeWallet(walletObj.privateKey, network);
                        wallet = result.wallet;
                    } catch (error) {
                        continue;
                    }

                    for (let i = 1; i <= parsedNumTxs; i++) {
                        try {
                            // Random action selection (1: USDC->R2USD, 2: R2USD->USDC, 3: Stake)
                            const action = Math.floor(Math.random() * 3) + 1;
                            let success = false;

                            switch (action) {
                                case 1:
                                    log(`${colorText(`Transaction ${i}/${parsedNumTxs}: Random USDC to R2USD swap`, COLORS.YELLOW)}`);
                                    success = await swapUSDCtoR2USD(wallet, null, network);
                                    break;
                                case 2:
                                    log(`${colorText(`Transaction ${i}/${parsedNumTxs}: Random R2USD to USDC swap`, COLORS.YELLOW)}`);
                                    success = await swapR2USDtoUSDC(wallet, null, network);
                                    break;
                                case 3:
                                    log(`${colorText(`Transaction ${i}/${parsedNumTxs}: Random R2USD staking`, COLORS.YELLOW)}`);
                                    success = await stakeR2USD(wallet, null, network);
                                    break;
                            }

                            if (!success) {
                                log(`${colorText(`Transaction ${i} failed, waiting before next attempt...`, COLORS.YELLOW)}`);
                            }

                            // Add consistent delay between transactions
                            if (i < parsedNumTxs) {
                                await delay(5, 10); // 5-10 seconds delay
                            }

                        } catch (error) {
                            log(`${colorText(`Error in transaction ${i}: ${error.message}`, COLORS.RED)}`);
                            // Add delay even after error
                            if (i < parsedNumTxs) {
                                await delay(5, 10);
                            }
                            continue;
                        }
                    }

                    log(`${colorText(`Completed transactions for wallet: ${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`, COLORS.GREEN)}`);
                }
            }

            log(`${colorText(`All transactions completed! Pausing for 24 hours...`, COLORS.YELLOW)}`);
            await new Promise(resolve => setTimeout(resolve, 24 * 60 * 60 * 1000));
            log(`${colorText(`Restarting cycle...`, COLORS.CYAN)}`);
            await runRandomCycle();
        };

        await runRandomCycle();
    } catch (error) {
        log(`${colorText(`Error in auto-run cycle: ${error.message}`, COLORS.RED)}`);
        await showMenu(wallets);
    }
}

// Update transaction retry mechanism
async function retryTransaction(func, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await func();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            log(`${colorText(`Retry ${i + 1}/${maxRetries}: ${error.message}`, COLORS.YELLOW)}`);
            await delay(5, 10); // Add delay between retries
        }
    }
}

// Update error handling in swap functions
async function swapUSDCtoR2USD(wallet, amount, network) {
    try {
        const amountInWei = ethers.utils.parseUnits(amount.toString(), 6);
        
        // Check balance
        const tokenContract = new ethers.Contract(network.contracts.USDC_ADDRESS, ERC20_ABI, wallet);
        const balance = await tokenContract.balanceOf(wallet.address);
        
        if (amountInWei.gt(balance)) {
            console.log(chalk[COLORS.RED](`Insufficient USDC balance for swap`));
            return false;
        }

        // Approve with retry
        const approved = await retryTransaction(async () => {
            return await approveToken(wallet, network.contracts.USDC_ADDRESS, network.contracts.USDC_TO_R2USD_CONTRACT, ethers.utils.formatUnits(amountInWei, 6), network);
        });
        
        if (!approved) return false;

        // Prepare transaction
        let data;
        
        if (network.name === 'Sepolia' || network.name === 'Plume Testnet') {
            data = ethers.utils.hexConcat([
                network.contracts.USDC_TO_R2USD_METHOD_ID,
                ethers.utils.defaultAbiCoder.encode(
                    ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
                    [wallet.address, amountInWei, 0, 0, 0, 0, 0]
                ),
            ]);
        } else {
            const minOutput = amountInWei.mul(97).div(100);
            const swapContract = new ethers.Contract(network.contracts.USDC_TO_R2USD_CONTRACT, SWAP_ABI, wallet);
            data = swapContract.interface.encodeFunctionData('exchange', [0, 1, amountInWei, minOutput]);
        }

        // Execute transaction with retry
        return await retryTransaction(async () => {
        const gasFees = await estimateGasFees(wallet.provider);
        const tx = {
            to: network.contracts.USDC_TO_R2USD_CONTRACT,
            data: data,
            ...gasFees,
        };

        const gasLimit = await estimateGas(wallet, tx);
            log(`${colorText(`Swapping ${amount} USDC to R2USD`, COLORS.YELLOW)}`);
            
        const stopSpinner = showSpinner(
                `Swapping ${amount} USDC to R2USD...`,
                `Swap completed`,
                60
            );

            try {
                const signedTx = await wallet.sendTransaction({ ...tx, gasLimit });
                log(`${colorText(`Transaction: ${signedTx.hash}`, COLORS.GREEN)}`);
        await signedTx.wait();
        stopSpinner();

                // Verify the swap
        const newUSDCBalance = await checkBalance(wallet, network.contracts.USDC_ADDRESS);
        const newR2USDBalance = await checkBalance(wallet, network.contracts.R2USD_ADDRESS);
                log(`${colorText(`New USDC: ${newUSDCBalance}, New R2USD: ${newR2USDBalance}`, COLORS.WHITE)}`);
                
        await updateWalletInfo([wallet], network);
        return true;
    } catch (error) {
        stopSpinner();
                if (error.message.includes('timeout')) {
                    log(colorText(`Transaction may be pending. Check explorer: ${network.explorer}/tx/${signedTx.hash}`, COLORS.YELLOW));
                }
        throw error;
    }
        });
        } catch (error) {
        log(colorText(`USDC to R2USD swap failed: ${error.message}`, COLORS.RED));
                return false;
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

async function main() {
  try {
    await new Promise(resolve => {
      showBanner();
      setTimeout(resolve, 450);
    });

    loadProxies();
    loadPrivateKeys();
    const wallets = [];
    const firstNetwork = Object.values(NETWORKS)[0];
    for (const privateKey of privateKeys) {
      try {
        const result = await initializeWallet(privateKey, firstNetwork);
        wallets.push({ privateKey, wallet: result.wallet, network: firstNetwork });
      } catch (error) {
        // Skip failed wallet initialization
      }
    }
    if (wallets.length === 0) {
      log(`${colorText(`No valid wallets initialized. Exiting.`, COLORS.RED)}`);
      process.exit(1);
    }
    await updateWalletInfo(wallets.map(w => w.wallet), firstNetwork);
    await showMenu(wallets);
  } catch (error) {
    log(`${colorText(`Fatal error: ${error.message}`, COLORS.RED)}`);
    process.exit(1);
  }
}

main();

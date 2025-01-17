const BLOCK_DATE_KEY_SUBSTRING = 'ethBlockDate-';
const HASH_DONE_KEY_SUBSTRING = 'ethToFuelTx';
const TX_CREATED_KEY_SUBSTRING = 'ethTxCreated';

export const EthTxCache = {
  getBlockDate: (blockHash: string) => {
    return !!blockHash && localStorage.getItem(generateBlockDateKey(blockHash));
  },
  setBlockDate: (blockHash: string, blockDate: string) => {
    return localStorage.setItem(generateBlockDateKey(blockHash), blockDate);
  },
  getTxIsDone: (blockHash: string) => {
    return (
      !!blockHash &&
      localStorage.getItem(generateHashDoneKey(blockHash)) === 'true'
    );
  },
  setTxIsDone: (blockHash: string) => {
    return localStorage.setItem(generateHashDoneKey(blockHash), 'true');
  },
  clean: () => {
    Object.keys(localStorage).forEach((key) => {
      if (
        key.includes(BLOCK_DATE_KEY_SUBSTRING) ||
        key.includes(HASH_DONE_KEY_SUBSTRING)
      ) {
        localStorage.removeItem(key);
      }
    });
  },
  setTxIsCreated: (txId: string) => {
    localStorage.setItem(generateTxCreatedKey(txId), 'true');
  },
  removeTxCreated: (txId: string) => {
    localStorage.removeItem(generateTxCreatedKey(txId));
  },
  getTxIsCreated: (txId: string) => {
    return localStorage.getItem(generateTxCreatedKey(txId)) === 'true';
  },
};

const generateBlockDateKey = (blockHash: string) => {
  return `${BLOCK_DATE_KEY_SUBSTRING}${blockHash}`;
};

const generateHashDoneKey = (blockhash: string) => {
  return `${HASH_DONE_KEY_SUBSTRING}${blockhash}-done`;
};

const generateTxCreatedKey = (txId: string) => {
  return `${TX_CREATED_KEY_SUBSTRING}-${txId}`;
};

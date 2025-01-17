import {
  contractMessagePredicate,
  contractMessageScript,
} from '@fuel-bridge/message-predicates';
import type {
  Message,
  WalletUnlocked as FuelWallet,
  TransactionRequestLike,
  TransactionResponse,
} from 'fuels';
import {
  ZeroBytes32,
  ScriptTransactionRequest,
  arrayify,
  InputType,
  hexlify,
  OutputType,
  Predicate,
  bn,
  Provider,
} from 'fuels';

import { resourcesToInputs } from './transaction';

function getCommonRelayableMessages(provider: Provider) {
  // Create a predicate for common messages
  const predicate = new Predicate(contractMessagePredicate, provider);

  // Details for relaying common messages with certain predicate roots
  const relayableMessages: CommonMessageDetails[] = [
    {
      name: 'Message To Contract v1.3',
      predicateRoot: predicate.address.toHexString(),
      predicate: contractMessagePredicate,
      script: contractMessageScript,
      buildTx: async (
        relayer: FuelWallet,
        message: Message,
        details: CommonMessageDetails,
        txParams: Pick<
          TransactionRequestLike,
          'gasLimit' | 'gasPrice' | 'maturity'
        >
      ): Promise<ScriptTransactionRequest> => {
        const script = arrayify(details.script);
        const predicateBytecode = arrayify(details.predicate);
        // get resources to fund the transaction
        const resources = await relayer.getResourcesToSpend([
          {
            amount: bn(100),
            assetId: ZeroBytes32,
          },
        ]);
        // convert resources to inputs
        const spendableInputs = resourcesToInputs(resources);

        // get contract id
        const data = arrayify(message.data);
        if (data.length < 32)
          throw new Error('cannot find contract ID in message data');
        const contractId = hexlify(data.slice(0, 32));

        const { maxGasPerTx } = provider.getGasConfig();
        // build the transaction
        const transaction = new ScriptTransactionRequest({
          script,
          gasLimit: maxGasPerTx,
          ...txParams,
        });
        transaction.inputs.push({
          type: InputType.Message,
          amount: message.amount,
          sender: message.sender.toHexString(),
          recipient: message.recipient.toHexString(),
          witnessIndex: 0,
          data: message.data,
          nonce: message.nonce,
          predicate: predicateBytecode,
        });
        transaction.inputs.push({
          type: InputType.Contract,
          txPointer: ZeroBytes32,
          contractId,
        });
        transaction.inputs.push(...spendableInputs);

        transaction.outputs.push({
          type: OutputType.Contract,
          inputIndex: 1,
        });
        transaction.outputs.push({
          type: OutputType.Change,
          to: relayer.address.toB256(),
          assetId: ZeroBytes32,
        });
        transaction.outputs.push({
          type: OutputType.Variable,
        });

        transaction.witnesses.push('0x');

        return transaction;
      },
    },
  ];

  return relayableMessages;
}

type CommonMessageDetails = {
  name: string;
  predicateRoot: string;
  predicate: string;
  script: string;
  buildTx: (
    relayer: FuelWallet,
    message: Message,
    details: CommonMessageDetails,
    txParams: Pick<TransactionRequestLike, 'gasLimit' | 'gasPrice' | 'maturity'>
  ) => Promise<ScriptTransactionRequest>;
};

// Relay commonly used messages with predicates spendable by anyone
export async function relayCommonMessage({
  relayer,
  message,
  txParams,
}: {
  relayer: FuelWallet;
  message: Message;
  txParams?: Pick<TransactionRequestLike, 'gasLimit' | 'gasPrice' | 'maturity'>;
}): Promise<TransactionResponse> {
  // find the relay details for the specified message
  let messageRelayDetails: CommonMessageDetails | undefined;
  const predicateRoot = message.recipient.toHexString();

  // eslint-disable-next-line no-restricted-syntax

  // TODO: should use the fuelProvider from input when wallet gets updated with new SDK
  const provider = await Provider.create(relayer.provider.url);
  for (const details of getCommonRelayableMessages(provider)) {
    if (details.predicateRoot.toLowerCase() === predicateRoot.toLowerCase()) {
      messageRelayDetails = details;
      break;
    }
  }
  if (!messageRelayDetails)
    throw new Error('message is not a common relayable message');

  // build and send transaction
  const transaction = await messageRelayDetails.buildTx(
    relayer,
    message,
    messageRelayDetails,
    txParams || {}
  );

  return relayer.sendTransaction(transaction);
}

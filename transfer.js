//https://api.developer.coinbase.com/rpc/v1/base/gF62n8NUIMSP0LIeJM0jpAAHC9LIxLE8

import { createPaymasterClient } from 'viem/account-abstraction'

const paymasterClient = createPaymasterClient({ 
  transport: http("YOUR_COINBASE_PAYMASTER_URL") 
})

// When sending the transaction (UserOperation)
const hash = await bundlerClient.sendUserOperation({
  account: mySmartAccount,
  calls: [{ to: '0x...', value: 0n, data: '0x...' }],
  paymaster: paymasterClient, // This tells the network YOU are paying
})
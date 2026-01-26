# QuickStart

> Get started with the Cerebras API.

<Tip>**To get started with a free API key, [click here](https://cloud.cerebras.ai?utm_source=3pi_quickstart\&utm_campaign=docs).**</Tip>

This QuickStart guide is designed to assist you in making your first API call. If you are an experienced AI applications developer, you may find it more beneficial to go directly to the [API reference documentation](https://inference-docs.cerebras.ai/api-reference/chat-completions).

If you would like to interact with the models using Cerebras’ Inference solution before making an API call, please visit the [developer playground](https://cloud.cerebras.ai?utm_source=3pi_quickstart\&utm_campaign=docs).

This guide will walk you through:

* Setting up your developer environment

* Installing the Cerebras Inference library

* Making your first request to the Cerebras API

## Prerequisites

To complete this guide, you will need:

* A Cerebras account

* A Cerebras Inference API key

* Python 3.7+ or TypeScript 4.5+

<Steps>
  <Step title="Set up your API key">
    The first thing you will need is a valid API key. Please visit [this link](https://cloud.cerebras.ai?utm_source=3pi_quickstart\&utm_campaign=docs) and navigate to “API Keys” on the left nav bar.

    For security reasons and to avoid configuring your API key each time, it is recommended to set your API key as an environment variable. You can do this by running the following command in your terminal:

    ```bash  theme={null}
    export CEREBRAS_API_KEY="your-api-key-here"
    ```
  </Step>

  <Step title="Install the Cerebras Inference library">
    The Cerebras Inference library is available for download and installation through the Python Package Index (PyPI) and the npm package manager. To install the library run either of the following commands in your terminal, based on your language of choice:

    <Note>
      Note: You can also call the underlying API directly (see cURL request example below in Step 3).
    </Note>

    <CodeGroup>
      ```bash Python theme={null}
      pip install --upgrade cerebras_cloud_sdk
      ```

      ```bash Node.js theme={null}
      npm install @cerebras/cerebras_cloud_sdk@latest
      ```
    </CodeGroup>
  </Step>

  <Step title="Making an API request">
    <Tip>
      If your request is being blocked by CloudFront, ensure that `User-Agent` is included in your headers
    </Tip>

    Once you have configured your API key, you are ready to send your first API request.

    The following code snippets demonstrate how to make an API request to the Cerebras API to perform a chat completion.

    <CodeGroup>

      ```javascript Node.js theme={null}
      import Cerebras from '@cerebras/cerebras_cloud_sdk';

      const client = new Cerebras({
        apiKey: process.env['CEREBRAS_API_KEY'], // This is the default and can be omitted
      });

      async function main() {
        const completionCreateResponse = await client.chat.completions.create({
          messages: [{ role: 'user', content: 'Why is fast inference important?' }],
          model: 'llama-3.3-70b',
        });

        console.log(completionCreateResponse);
      }

      main();
      ```
    </CodeGroup>
  </Step>
</Steps>

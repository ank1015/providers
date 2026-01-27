# Main Concepts

## Text Generation Model [Permalink for this section](https://platform.moonshot.ai/docs/introduction\#text-generation-model)

Moonshot's text generation model (referred to as moonshot-v1) is trained to understand both natural and written language. It can generate text output based on the input provided. The input to the model is also known as a "prompt." We generally recommend that you provide clear instructions and some examples to enable the model to complete the intended task. Designing a prompt is essentially learning how to "train" the model. The moonshot-v1 model can be used for a variety of tasks, including content or code generation, summarization, conversation, and creative writing.

## Language Model Inference Service [Permalink for this section](https://platform.moonshot.ai/docs/introduction\#language-model-inference-service)

The language model inference service is an API service based on the pre-trained models developed and trained by us (Moonshot AI). In terms of design, we primarily offer a Chat Completions interface externally, which can be used to generate text. However, it does not support access to external resources such as the internet or databases, nor does it support the execution of any code.

## Token [Permalink for this section](https://platform.moonshot.ai/docs/introduction\#token)

Text generation models process text in units called Tokens. A Token represents a common sequence of characters. For example, a single English character like "antidisestablishmentarianism" might be broken down into a combination of several Tokens, while a short and common phrase like "word" might be represented by a single Token. Generally speaking, for a typical English text, 1 Token is roughly equivalent to 3-4 English characters.

It is important to note that for our text model, the total length of Input and Output cannot exceed the model's maximum context length.

## Rate Limits [Permalink for this section](https://platform.moonshot.ai/docs/introduction\#rate-limits)

How do these rate limits work?

Rate limits are measured in four ways: concurrency, RPM (requests per minute), TPM (Tokens per minute), and TPD (Tokens per day). The rate limit can be reached in any of these categories, depending on which one is hit first. For example, you might send 20 requests to ChatCompletions, each with only 100 Tokens, and you would hit the limit (if your RPM limit is 20), even if you haven't reached 200k Tokens in those 20 requests (assuming your TPM limit is 200k).

For the gateway, for convenience, we calculate rate limits based on the max\_tokens parameter in the request. This means that if your request includes the max\_tokens parameter, we will use this parameter to calculate the rate limit. If your request does not include the max\_tokens parameter, we will use the default max\_tokens parameter to calculate the rate limit. After you make a request, we will determine whether you have reached the rate limit based on the number of Tokens in your request plus the number of max\_tokens in your parameter, regardless of the actual number of Tokens generated.

In the billing process, we calculate the cost based on the number of Tokens in your request plus the actual number of Tokens generated.

### Other Important Notes: [Permalink for this section](https://platform.moonshot.ai/docs/introduction\#other-important-notes)

- Rate limits are enforced at the user level, not the key level.
- Currently, we share rate limits across all models.

## Model List [Permalink for this section](https://platform.moonshot.ai/docs/introduction\#model-list)

You can use our [List Models API](https://platform.moonshot.ai/docs/api/chat#list-models) to get a list of currently available models.

### Multi-modal Model kimi-k2.5 [Permalink for this section](https://platform.moonshot.ai/docs/introduction\#multi-modal-model-kimi-k25)

| Model Name | Description |
| --- | --- |
| `kimi-k2.5` | Kimi's most intelligent model to date, achieving open-source SoTA performance in Agent, code, visual understanding, and a range of general intelligent tasks. It is also Kimi's most versatile model to date, featuring a native multimodal architecture that supports both visual and text input, thinking and non-thinking modes, and dialogue and Agent tasks. Context 256k |

### kimi-k2 Model [Permalink for this section](https://platform.moonshot.ai/docs/introduction\#kimi-k2-model)

| Model Name | Description |
| --- | --- |
| `kimi-k2-0905-preview` | Context length 256k, enhanced Agentic Coding capabilities, front-end code aesthetics and practicality, and context understanding capabilities based on the 0711 version |
| `kimi-k2-0711-preview` | Context length 128k, MoE architecture base model with 1T total parameters, 32B activated parameters. Features powerful code and Agent capabilities. [View technical blog (opens in a new tab)](https://moonshotai.github.io/Kimi-K2/) |
| `kimi-k2-turbo-preview` | High-speed version of K2, benchmarking against the latest version (0905). Output speed increased to 60-100 tokens per second, context length 256k |
| `kimi-k2-thinking` | K2 Long-term thinking model, supports 256k context, supports multi-step tool usage and reasoning, excels at solving more complex problems |
| `kimi-k2-thinking-turbo` | K2 Long-term thinking model high-speed version, supports 256k context, excels at deep reasoning, output speed increased to 60-100 tokens per second |

### Generation Model moonshot-v1 [Permalink for this section](https://platform.moonshot.ai/docs/introduction\#generation-model-moonshot-v1)

| Model Name | Description |
| --- | --- |
| `moonshot-v1-8k` | Suitable for generating short texts, context length 8k |
| `moonshot-v1-32k` | Suitable for generating long texts, context length 32k |
| `moonshot-v1-128k` | Suitable for generating very long texts, context length 128k |
| `moonshot-v1-8k-vision-preview` | Vision model, understands image content and outputs text, context length 8k |
| `moonshot-v1-32k-vision-preview` | Vision model, understands image content and outputs text, context length 32k |
| `moonshot-v1-128k-vision-preview` | Vision model, understands image content and outputs text, context length 128k |

> Note: The only difference between these moonshot-v1 models is their maximum context length (including input and output), there is no difference in effect.

### Generation Model kimi-latest [Permalink for this section](https://platform.moonshot.ai/docs/introduction\#generation-model-kimi-latest)

| Model Name | Description |
| --- | --- |
| `kimi-latest` | Vision model with 128k context length, supports image understanding. Uses the latest version of Kimi intelligent assistant, may include features that are not yet stable |

### Deprecated Models [Permalink for this section](https://platform.moonshot.ai/docs/introduction\#deprecated-models)

> `kimi-thinking-preview` was officially discontinued on **November 11, 2025** and is no longer maintained or supported.
>
> We recommend upgrading to the [kimi-k2-thinking-preview model](https://platform.moonshot.ai/docs/guide/use-kimi-k2-thinking-model) for continued support and enhanced reasoning capabilities.

For further assistance, please [contact sales](https://platform.moonshot.ai/contact-sales).

# Usage Guide

## Getting an API Key [Permalink for this section](https://platform.moonshot.ai/docs/introduction\#getting-an-api-key)

You need an API key to use our service. You can create an [API key](https://platform.moonshot.ai/console/api-keys) in our [Console](https://platform.moonshot.ai/console).

## Sending Requests [Permalink for this section](https://platform.moonshot.ai/docs/introduction\#sending-requests)

You can use our Chat Completions API to send requests. You need to provide an API key and a model name. You can choose to use the default max\_tokens parameter or customize the max\_tokens parameter. You can refer to the [API documentation](https://platform.moonshot.ai/docs/api-reference#python-usage) for the calling method.

## Handling Responses [Permalink for this section](https://platform.moonshot.ai/docs/introduction\#handling-responses)

Generally, we set a 5-minute timeout. If a single request exceeds this time, we will return a 504 error. If your request exceeds the rate limit, we will return a 429 error. If your request is successful, we will return a response in JSON format.

If you need to quickly process some tasks, you can use the non-streaming mode of our Chat Completions API. In this mode, we will return all the generated text in one request. If you need more control, you can use the streaming mode. In this mode, we will return an [SSE (opens in a new tab)](https://kimi.moonshot.cn/share/cr7boh3dqn37a5q9tds0) stream, where you can obtain the generated text. This can provide a better user experience, and you can also interrupt the request at any time without wasting resources.

Last updated on January 26, 2026

# Chat

# Basic Information

## Public Service Address [Permalink for this section](https://platform.moonshot.ai/docs/api/chat\#public-service-address)

```
https://api.moonshot.ai
```

Moonshot offers API services based on HTTP, and for most APIs, we are compatible with the OpenAI SDK.

# Quickstart

## Single-turn chat [Permalink for this section](https://platform.moonshot.ai/docs/api/chat\#single-turn-chat)

The official OpenAI SDK supports [Python (opens in a new tab)](https://github.com/openai/openai-python) and [Node.js (opens in a new tab)](https://github.com/openai/openai-node). Below are examples of how to interact with the API using OpenAI SDK and Curl:

pythoncurlnode.js

```
from openai import OpenAI

client = OpenAI(
    api_key = "$MOONSHOT_API_KEY",
    base_url = "https://api.moonshot.ai/v1",
)

completion = client.chat.completions.create(
    model = "kimi-k2-turbo-preview",
    messages = [\
        {"role": "system", "content": "You are Kimi, an AI assistant provided by Moonshot AI. You are proficient in Chinese and English conversations. You provide users with safe, helpful, and accurate answers. You will reject any questions involving terrorism, racism, or explicit content. Moonshot AI is a proper noun and should not be translated."},\
        {"role": "user", "content": "Hello, my name is Li Lei. What is 1+1?"}\
    ],
    temperature = 0.6,
)

print(completion.choices[0].message.content)
```

Replace `$MOONSHOT_API_KEY` with the API Key you created on the platform.

When running the code in the documentation using the OpenAI SDK, ensure that your Python version is at least 3.7.1, your Node.js version is at least 18, and your OpenAI SDK version is no lower than 1.0.0.

```
pip install --upgrade 'openai>=1.0'
```

> You can easily check the version of your library like this:
>
> ```
> python -c 'import openai; print("version =",openai.__version__)'
> # The output might be version = 1.10.0, indicating that the current python is using the v1.10.0 library of openai
> ```

## Multi-turn chat [Permalink for this section](https://platform.moonshot.ai/docs/api/chat\#multi-turn-chat)

In the single-turn chat example above, the language model takes a list of user messages as input and returns the generated response as output.
Sometimes, we can also use the model's output as part of the input to achieve multi-turn chat. Below is a simple example of implementing multi-turn chat:

pythonnode.js

```
from openai import OpenAI

client = OpenAI(
    api_key = "$MOONSHOT_API_KEY",
    base_url = "https://api.moonshot.ai/v1",
)

history = [\
    {"role": "system", "content": "You are Kimi, an AI assistant provided by Moonshot AI. You are proficient in Chinese and English conversations. You provide users with safe, helpful, and accurate answers. You will reject any questions involving terrorism, racism, or explicit content. Moonshot AI is a proper noun and should not be translated."}\
]

def chat(query, history):
    history.append({
        "role": "user",
        "content": query
    })
    completion = client.chat.completions.create(
        model="kimi-k2-turbo-preview",
        messages=history,
        temperature=0.6,
    )
    result = completion.choices[0].message.content
    history.append({
        "role": "assistant",
        "content": result
    })
    return result

print(chat("What is the rotation period of the Earth?", history))
print(chat("What about the Moon?", history))
```

It is worth noting that as the chat progresses, the number of tokens the model needs to process will increase linearly. When necessary, some optimization strategies should be employed, such as retaining only the most recent few rounds of chat.

# API Documentation

## Chat Completion [Permalink for this section](https://platform.moonshot.ai/docs/api/chat\#chat-completion)

### Request URL [Permalink for this section](https://platform.moonshot.ai/docs/api/chat\#request-url)

```
POST https://api.moonshot.ai/v1/chat/completions
```

### Request [Permalink for this section](https://platform.moonshot.ai/docs/api/chat\#request)

#### Example [Permalink for this section](https://platform.moonshot.ai/docs/api/chat\#example)

```
{
    "model": "kimi-k2-turbo-preview",
    "messages": [\
        {\
            "role": "system",\
            "content": "You are Kimi, an AI assistant provided by Moonshot AI. You are proficient in Chinese and English conversations. You aim to provide users with safe, helpful, and accurate responses. You will refuse to answer any questions related to terrorism, racism, or explicit content. Moonshot AI is a proper noun and should not be translated into other languages."\
        },\
        { "role": "user", "content": "Hello, my name is Li Lei. What is 1+1?" }\
    ],
    "temperature": 0.6
}
```

#### Request body [Permalink for this section](https://platform.moonshot.ai/docs/api/chat\#request-body)

| Field | Required | Description | Type | Values |
| --- | --- | --- | --- | --- |
| messages | required | A list of messages that have been exchanged in the conversation so far | List\[Dict\] | This is a list of structured elements, each similar to: `{"role": "user", "content": "Hello"}` The role can only be one of `system`, `user`, `assistant`, and the content must not be empty |
| model | required | Model ID, which can be obtained through List Models | string | Currently one of `kimi-k2.5`,`kimi-k2-0905-preview`, `kimi-k2-0711-preview`, `kimi-k2-turbo-preview`, `kimi-k2-thinking-turbo`, `kimi-k2-thinking`, `moonshot-v1-8k`,`moonshot-v1-32k`,`moonshot-v1-128k`, `moonshot-v1-auto`,`kimi-latest`,`moonshot-v1-8k-vision-preview`,`moonshot-v1-32k-vision-preview`,`moonshot-v1-128k-vision-preview` |
| max\_tokens | optional | The maximum number of tokens to generate for the chat completion. If the result reaches the maximum number of tokens without ending, the finish reason will be "length"; otherwise, it will be "stop" | int | It is recommended to provide a reasonable value as needed. If not provided, we will use a good default integer like 1024. **Note:** This `max_tokens` refers to the length of the tokens you expect us to **return**, not the total length of input plus output. For example, for a `moonshot-v1-8k` model, the maximum total length of input plus output is 8192. When the total length of the input messages is 4096, you can set this to a maximum of 4096; otherwise, our service will return an invalid input parameter (invalid\_request\_error) and refuse to respond. If you want to know the "exact number of input tokens," you can use the "Token Calculation" API below to get the count using our calculator |
| temperature | optional | The sampling temperature to use, ranging from 0 to 1. A higher value (e.g., 0.7) will make the output more random, while a lower value (e.g., 0.2) will make it more focused and deterministic | float | Default is 0.0 for `moonshot-v1` series models, 0.6 for `kimi-k2` models and 1.0 for `kimi-k2-thinking` models. This parameter cannot be modified for the `kimi-k2.5` model. |
| top\_p | optional | Another sampling method, where the model considers the results of tokens with a cumulative probability mass of top\_p. Thus, 0.1 means only considering the top 10% of tokens by probability mass. Generally, we suggest changing either this or the temperature, but not both at the same time | float | Default is 1.0 for `moonshot-v1` series and `kimi-k2` models, 0.95 for `kimi-k2.5` model. This parameter cannot be modified for the `k2.5` model. |
| n | optional | The number of results to generate for each input message | int | Default is 1 for `moonshot-v1` series and `kimi-k2` models, and it must not exceed 5. Specifically, when the temperature is very close to 0, we can only return one result. If n is set and > 1 in this case, our service will return an invalid input parameter (invalid\_request\_error). Default is 1 for `kimi-k2.5` model and it cannot be modified. |
| presence\_penalty | optional | Presence penalty, a number between -2.0 and 2.0. A positive value will penalize new tokens based on whether they appear in the text, increasing the likelihood of the model discussing new topics | float | Default is 0. This parameter cannot be modified for the `kimi-k2.5` model. |
| frequency\_penalty | optional | Frequency penalty, a number between -2.0 and 2.0. A positive value will penalize new tokens based on their existing frequency in the text, reducing the likelihood of the model repeating the same phrases verbatim | float | Default is 0. This parameter cannot be modified for the `kimi-k2.5` model. |
| response\_format | optional | Setting this to `{"type": "json_object"}` enables JSON mode, ensuring that the generated information is valid JSON. When you set response\_format to `{"type": "json_object"}`, **you must explicitly guide the model to output JSON-formatted content in the prompt and specify the exact format of the JSON, otherwise it may result in unexpected outcomes**. | object | Default is `{"type": "text"}` |
| stop | optional | Stop words, which will halt the output when a full match is found. The matched words themselves will not be output. A maximum of 5 strings is allowed, and each string must not exceed 32 bytes | String, List\[String\] | Default is null |
| thinking | optional | Only available for `kimi-k2.5` model. This parameter controls if the thinking is enabled for this request | object | Default to be `{"type": "enabled"}`. Value can only be one of `{"type": "enabled"}` or `{"type": "disabled"}` |
| stream | optional | Whether to return the response in a streaming fashion | bool | Default is false, and true is an option |

### Return [Permalink for this section](https://platform.moonshot.ai/docs/api/chat\#return)

For non-streaming responses, the return format is similar to the following:

```
{
    "id": "cmpl-04ea926191a14749b7f2c7a48a68abc6",
    "object": "chat.completion",
    "created": 1698999496,
    "model": "kimi-k2-turbo-preview",
    "choices": [\
        {\
            "index": 0,\
            "message": {\
                "role": "assistant",\
                "content": "Hello, Li Lei! 1+1 equals 2. If you have any other questions, feel free to ask!"\
            },\
            "finish_reason": "stop"\
        }\
    ],
    "usage": {
        "prompt_tokens": 19,
        "completion_tokens": 21,
        "total_tokens": 40,
        "cached_tokens": 10  # The number of tokens hit by the cache, only models that support automatic caching will return this field
    }
}
```

For streaming responses, the return format is similar to the following:

```
data: {"id":"cmpl-1305b94c570f447fbde3180560736287","object":"chat.completion.chunk","created":1698999575,"model":"kimi-k2-turbo-preview","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

data: {"id":"cmpl-1305b94c570f447fbde3180560736287","object":"chat.completion.chunk","created":1698999575,"model":"kimi-k2-turbo-preview","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

...

data: {"id":"cmpl-1305b94c570f447fbde3180560736287","object":"chat.completion.chunk","created":1698999575,"model":"kimi-k2-turbo-preview","choices":[{"index":0,"delta":{"content":"."},"finish_reason":null}]}

data: {"id":"cmpl-1305b94c570f447fbde3180560736287","object":"chat.completion.chunk","created":1698999575,"model":"kimi-k2-turbo-preview","choices":[{"index":0,"delta":{},"finish_reason":"stop","usage":{"prompt_tokens":19,"completion_tokens":13,"total_tokens":32}}]}

data: [DONE]
```

### Example Request [Permalink for this section](https://platform.moonshot.ai/docs/api/chat\#example-request)

For simple calls, refer to the previous example. For streaming calls, you can refer to the following code snippet:

pythoncurlnode.js

```
from openai import OpenAI

client = OpenAI(
    api_key = "$MOONSHOT_API_KEY",
    base_url = "https://api.moonshot.ai/v1",
)

response = client.chat.completions.create(
    model="kimi-k2-turbo-preview",
    messages=[\
        {\
            "role": "system",\
            "content": "You are Kimi, an AI assistant provided by Moonshot AI. You excel at conversing in Chinese and English. You provide users with safe, helpful, and accurate responses. You refuse to answer any questions related to terrorism, racism, or explicit content. Moonshot AI is a proper noun and should not be translated into other languages.",\
        },\
        {"role": "user", "content": "Hello, my name is Li Lei. What is 1+1?"},\
    ],
    temperature=0.6,
    stream=True,
)

collected_messages = []
for idx, chunk in enumerate(response):
    # print("Chunk received, value: ", chunk)
    chunk_message = chunk.choices[0].delta
    if not chunk_message.content:
        continue
    collected_messages.append(chunk_message)  # save the message
    print(f"#{idx}: {''.join([m.content for m in collected_messages])}")
print(f"Full conversation received: {''.join([m.content for m in collected_messages])}")
```

### Vision [Permalink for this section](https://platform.moonshot.ai/docs/api/chat\#vision)

#### Example [Permalink for this section](https://platform.moonshot.ai/docs/api/chat\#example-1)

```
{
    "model": "moonshot-v1-8k-vision-preview",
    "messages":
    [\
        {\
            "role": "system",\
            "content": "You are Kimi, an AI assistant provided by Moonshot AI. You are proficient in both Chinese and English conversations. You aim to provide users with safe, helpful, and accurate answers. You will refuse to answer any questions related to terrorism, racism, pornography, or violence. Moonshot AI is a proper noun and should not be translated into any other language."\
        },\
        {\
            "role": "user",\
            "content":\
            [\
                {\
                    "type": "image_url",\
                    "image_url":\
                    {\
                        "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABhCAYAAAApxKSdAAAACXBIWXMAACE4AAAhOAFFljFgAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAUUSURBVHgB7Z29bhtHFIWPHQN2J7lKqnhYpYvpIukCbJEAKQJEegLReYFIT0DrCSI9QEDqCSIDaQIEIOukiJwyza5SJWlId3FFz+HuGmuSSw6p+dlZ3g84luhdUeI9M3fmziyXgBCUe/DHYY0Wj/tgWmjV42zFcWe4MIBBPNJ6qqW0uvAbXFvQgKzQK62bQhkaCIPc10q1Zi3XH1o/IG9cwUm0RogrgDY1KmLgHYX9DvyiBvDYI77XmiD+oLlQHw7hIDoCMBOt1U9w0BsU9mOAtaUUFk3oQoIfzAQFCf5dNMEdTFCQ4NtQih1NSIGgf3ibxOJt5UrAB1gNK72vIdjiI61HWr+YnNxDXK0rJiULsV65GJeiIescLSTTeobKSutiCuojX8kU3MBx4I3WeNVBBRl4fWiCyoB8v2JAAkk9PmDwT8sH1TEghRjgC27scCx41wO43KAg+ILxTvhNaUACwTc04Z0B30LwzTzm5Rjw3sgseIG1wGMawMBPIOQcqvzrNIMHOg9Q5KK953O90/rFC+BhJRH8PQZ+fu7SjC7HAIV95yu99vjlxfvBJx8nwHd6IfNJAkccOjHg6OgIs9lsra6vr2GTNE03/k7q8HAhyJ/2gM9O65/4kT7/mwEcoZwYsPQiV3BwcABb9Ho9KKU2njccDjGdLlxx+InBBPBAAR86ydRPaIC9SASi3+8bnXd+fr78nw8NJ39uDJjXAVFPP7dp/VmWLR9g6w6Huo/IOTk5MTpvZesn/93AiP/dXCwd9SyILT9Jko3n1bZ+8s8rGPGvoVHbEXcPMM39V1dX9Qd/19PPNxta959D4HUGF0RrAFs/8/8mxuPxXLUwtfx2WX+cxdivZ3DFA0SKldZPuPTAKrikbOlMOX+9zFu/Q2iAQoSY5H7mfeb/tXCT8MdneU9wNNCuQUXZA0ynnrUznyqOcrspUY4BJunHqPU3gOgMsNr6G0B0BpgUXrG0fhKVAaaF1/HxMWIhKgNMcj9Tz82Nk6rVGdav/tJ5eraJ0Wi01XPq1r/xOS8uLkJc6XYnRTMNXdf62eIvLy+jyftVghnQ7Xahe8FW59fBTRYOzosDNI1hJdz0lBQkBflkMBjMU5iL13pXRb8fYAJrB/a2db0oFHthAOEUliaYFHE+aaUBdZsvvFhApyM0idYZwOCvW4JmIWdSzPmidQaYrAGZ7iX4oFUGnJ2dGdUCTRqMozeANQCLsE6nA10JG/0Mx4KmDMbBCjEWR2yxu8LAM98vXelmCA2ovVLCI8EMYODWbpbvCXtTBzQVMSAwYkBgxIDAtNKAXWdGIRADAiMpKDA0IIMQikx6QGDEgMCIAYGRMSAsMgaEhgbcQgjFa+kBYZnIGBCWWzEgLPNBOJ6Fk/aR8Y5ZCvktKwX/PJZ7xoVjfs+4chYU11tK2sE85qUBLyH4Zh5z6QHhGPOf6r2j+TEbcgdFP2RaHX5TrYQlDflj5RXE5Q1cG/lWnhYpReUGKdUewGnRmhvnCJbgmxey8sHiZ8iwF3AsUBBckKHI/SWLq6HsBc8huML4DiK80D6WnBqLzN68UFCmopheYJOVYgcU5FOVbAVfYUcUZGoaLPglCtITdg2+tZUFBTFh2+ArWEYh/7z0WIIQSiM43lt5AWAmWhLHylN4QmkNEXfAbGqEQKsHSfHLYwiSq8AnaAAKeaW3D8VbijwNW5nh3IN9FPI/jnpaPKZi2/SfFuJu4W3x9RqWL+N5C+7ruKpBAgLkAAAAAElFTkSuQmCC"\
                    }\
                },\
                {\
                    "type": "text",\
                    "text": "Please describe this image."\
                }\
            ]\
        }\
    ],
    "temperature": 0.6
}
```

#### Image Content Field Description [Permalink for this section](https://platform.moonshot.ai/docs/api/chat\#image-content-field-description)

When using the Vision model, the `message.content` field will change from `str` to `List[Object[str, any]]`. Each element in the `List` has the following fields:

| Parameter Name | Required | Description | Type |
| --- | --- | --- | --- |
| type | required | Supports only text type (text) or image type (image\_url) | string |
| image\_url | required | Object for transmitting the image | Dict\[str, any\] |

The fields for the `image_url` parameter are as follows:

| Parameter Name | Required | Description | Type |
| --- | --- | --- | --- |
| url | required | Image content encoded in base64 | string |

#### Example Request [Permalink for this section](https://platform.moonshot.ai/docs/api/chat\#example-request-1)

python

```
import os
import base64

from openai import OpenAI

client = OpenAI(
    api_key = os.environ.get("MOONSHOT_API_KEY"),
    base_url = "https://api.moonshot.ai/v1",
)

# Encode the image in base64
with open("your_image_path", 'rb') as f:
    img_base = base64.b64encode(f.read()).decode('utf-8')

response = client.chat.completions.create(
    model="moonshot-v1-8k-vision-preview",
    messages=[\
        {\
            "role": "user",\
            "content": [\
                {\
                    "type": "image_url",\
                    "image_url": {\
                        "url": f"data:image/jpeg;base64,{img_base}"\
                    }\
                },\
                {\
                    "type": "text",\
                    "text": "Please describe this image."\
                }\
            ]\
        }\
    ]
)
print(response.choices[0].message.content)
```

## List Models [Permalink for this section](https://platform.moonshot.ai/docs/api/chat\#list-models)

### Request URL [Permalink for this section](https://platform.moonshot.ai/docs/api/chat\#request-url-1)

```
GET https://api.moonshot.ai/v1/models
```

### Example request [Permalink for this section](https://platform.moonshot.ai/docs/api/chat\#example-request-2)

pythoncurlnode.js

```
from openai import OpenAI

client = OpenAI(
    api_key = "$MOONSHOT_API_KEY",
    base_url = "https://api.moonshot.ai/v1",
)

model_list = client.models.list()
model_data = model_list.data

for i, model in enumerate(model_data):
    print(f"model[{i}]:", model.id)
```

## Error Explanation [Permalink for this section](https://platform.moonshot.ai/docs/api/chat\#error-explanation)

Here are some examples of error responses:

```
{
    "error": {
        "type": "content_filter",
        "message": "The request was rejected because it was considered high risk"
    }
}
```

Below are explanations for the main errors:

| HTTP Status Code | error type | error message | Detailed Description |
| --- | --- | --- | --- |
| 400 | content\_filter | The request was rejected because it was considered high risk | Content review rejection, your input or generated content may contain unsafe or sensitive information. Please avoid prompts that could generate sensitive content. Thank you. |
| 400 | invalid\_request\_error | Invalid request: {error\_details} | Invalid request, usually due to incorrect request format or missing necessary parameters. Please check and retry. |
| 400 | invalid\_request\_error | Input token length too long | The length of tokens in the request is too long. Do not exceed the model's maximum token limit. |
| 400 | invalid\_request\_error | Your request exceeded model token limit : {max\_model\_length} | The sum of the tokens in the request and the set max\_tokens exceeds the model's specification length. Please check the request body's specifications or choose a model with an appropriate length. |
| 400 | invalid\_request\_error | Invalid purpose: only 'file-extract' accepted | The purpose (purpose) in the request is incorrect. Currently, only 'file-extract' is accepted. Please modify and retry. |
| 400 | invalid\_request\_error | File size is too large, max file size is 100MB, please confirm and re-upload the file | The uploaded file size exceeds the limit. Please re-upload. |
| 400 | invalid\_request\_error | File size is zero, please confirm and re-upload the file | The uploaded file size is 0. Please re-upload. |
| 400 | invalid\_request\_error | The number of files you have uploaded exceeded the max file count {max\_file\_count}, please delete previous uploaded files | The total number of uploaded files exceeds the limit. Please delete unnecessary earlier files and re-upload. |
| 401 | invalid\_authentication\_error | Invalid Authentication | Authentication failed. Please check if the apikey is correct and retry. |
| 401 | incorrect\_api\_key\_error | Incorrect API key provided | Authentication failed. Please check if the apikey is provided and correct, then retry. |
| 429 | exceeded\_current\_quota\_error | Your account {organization-id}<{ak-id}> is suspended, please check your plan and billing details | Account balance is insufficient. Please check your account balance. |
| 403 | permission\_denied\_error | The API you are accessing is not open | The API you are trying to access is not currently open. |
| 403 | permission\_denied\_error | You are not allowed to get other user info | Accessing other users' information is not permitted. Please check. |
| 404 | resource\_not\_found\_error | Not found the model {model-id} or Permission denied | The model does not exist or you do not have permission to access it. Please check and retry. |
| 429 | engine\_overloaded\_error | The engine is currently overloaded, please try again later | There are currently too many concurrent requests, and the node is rate-limited. Please retry later. It is recommended to upgrade your tier for a smoother experience. |
| 429 | exceeded\_current\_quota\_error | You exceeded your current token quota: <{organization\_id}> {token\_credit}, please check your account balance | Your account balance is insufficient. Please check your account balance and ensure it can cover the cost of your token consumption before retrying. |
| 429 | rate\_limit\_reached\_error | Your account {organization-id}<{ak-id}> request reached organization max concurrency: {Concurrency}, please try again after {time} seconds | Your request has reached the account's concurrency limit. Please wait for the specified time before retrying. |
| 429 | rate\_limit\_reached\_error | Your account {organization-id}<{ak-id}> request reached organization max RPM: {RPM}, please try again after {time} seconds | Your request has reached the account's RPM rate limit. Please wait for the specified time before retrying. |
| 429 | rate\_limit\_reached\_error | Your account {organization-id}<{ak-id}> request reached organization TPM rate limit, current:{current\_tpm}, limit:{max\_tpm} | Your request has reached the account's TPM rate limit. Please wait for the specified time before retrying. |
| 429 | rate\_limit\_reached\_error | Your account {organization-id}<{ak-id}> request reached organization TPD rate limit,current:{current\_tpd}, limit:{max\_tpd} | Your request has reached the account's TPD rate limit. Please wait for the specified time before retrying. |
| 500 | server\_error | Failed to extract file: {error} | Failed to parse the file. Please retry. |
| 500 | unexpected\_output | invalid state transition | Internal error. Please contact the administrator. |

Last updated on January 27, 2026


# Tool Use

Mastering the use of tools is a key hallmark of intelligence, and the Kimi large language model is no exception. Tool Use or Function Calling is a crucial feature of the Kimi large language model. When invoking the API to use the model service, you can describe tools or functions in the Messages, and the Kimi large language model will intelligently select and output a JSON object containing the parameters required to call one or more functions, thus enabling the Kimi large language model to link and utilize external tools.

Here is a simple example of tool invocation:

```
{
  "model": "kimi-k2-turbo-preview",
  "messages": [\
    {\
      "role": "user",\
      "content": "Determine whether 3214567 is a prime number through programming."\
    }\
  ],
  "tools": [\
    {\
      "type": "function",\
      "function": {\
        "name": "CodeRunner",\
        "description": "A code executor that supports running Python and JavaScript code",\
        "parameters": {\
          "properties": {\
            "language": {\
              "type": "string",\
              "enum": ["python", "javascript"]\
            },\
            "code": {\
              "type": "string",\
              "description": "The code is written here"\
            }\
          },\
          "type": "object"\
        }\
      }\
    }\
  ]
}
```

![A diagram of the example above](https://platform.moonshot.ai/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Ftooluse_whiteboard_example.en-US.c4ffe6ed.png&w=1920&q=75)

In the tools field, we can add a list of optional tools.

Each tool in the list must include a type. Within the function structure, we need to include a name (which should follow this regular expression as a specification: ^\[a-zA-Z\_\]\[a-zA-Z0-9-\_\]63$). A name that is an easily understandable English word is more likely to be accepted by the model. There should also be a description or enum. The description part explains what the tool can do, which helps the model to make judgments and selections.
The function structure must have a parameters field. The root of parameters must be an object, and the content is a subset of JSON schema (we will provide specific documentation to introduce the technical details later).
The number of functions in tools currently cannot exceed 128.

Like other APIs, we can call it through the Chat API.

pythoncurlnode.js

```
from openai import OpenAI

client = OpenAI(
    api_key = "$MOONSHOT_API_KEY",
    base_url = "https://api.moonshot.ai/v1",
)

completion = client.chat.completions.create(
    model = "kimi-k2-turbo-preview",
    messages = [\
        {"role": "system", "content": "You are Kimi, an AI assistant provided by Moonshot AI, who is more proficient in Chinese and English conversations. You will provide users with safe, helpful, and accurate answers. At the same time, you will reject any questions involving terrorism, racism, pornography, and violence. Moonshot AI is a proper noun and should not be translated into other languages."},\
        {"role": "user", "content": "Determine whether 3214567 is a prime number through programming."}\
    ],
    tools = [{\
        "type": "function",\
        "function": {\
            "name": "CodeRunner",\
            "description": "A code executor that supports running Python and JavaScript code",\
            "parameters": {\
                "properties": {\
                    "language": {\
                        "type": "string",\
                        "enum": ["python", "javascript"]\
                    },\
                    "code": {\
                        "type": "string",\
                        "description": "The code is written here"\
                    }\
                },\
            "type": "object"\
            }\
        }\
    }],
    temperature = 0.6,
)

print(completion.choices[0].message)
```

### Tool Configuration [Permalink for this section](https://platform.moonshot.ai/docs/api/tool-use\#tool-configuration)

You can also use some Agent platforms such as [Coze (opens in a new tab)](https://coze.cn/), [Bisheng (opens in a new tab)](https://github.com/dataelement/bisheng), [Dify (opens in a new tab)](https://github.com/langgenius/dify/), and [LangChain (opens in a new tab)](https://github.com/langchain-ai/langchain) to create and manage these tools, and design more complex workflows in conjunction with the Kimi large language model.



# Files

## Upload File [Permalink for this section](https://platform.moonshot.ai/docs/api/files\#upload-file)

> Note: Each user can upload a maximum of 1,000 files, with each file not exceeding 100MB in size. The total size of all uploaded files must not exceed 10GB. If you need to upload more files, you will need to delete some of the files that are no longer needed. The file parsing service is currently free, but during peak request periods, the platform may implement rate-limiting strategies.

### Request Endpoint [Permalink for this section](https://platform.moonshot.ai/docs/api/files\#request-endpoint)

```
POST https://api.moonshot.ai/v1/files
```

Once the file is successfully uploaded, we will process it accordingly.

### Example Request [Permalink for this section](https://platform.moonshot.ai/docs/api/files\#example-request)

#### Python Example [Permalink for this section](https://platform.moonshot.ai/docs/api/files\#python-example)

```
# The file can be of various types
# The purpose currently supports "file-extract", "image", and "video" types
file_object = client.files.create(file=Path("xlnet.pdf"), purpose="file-extract")
```

For `purpose="file-extract"`, the file contents will be extracted.
Additionally, you can use `purpose="image"` or `purpose="video"` to upload images and videos respectively for visual understanding.

### Supported Formats [Permalink for this section](https://platform.moonshot.ai/docs/api/files\#supported-formats)

The file interface is the same as the one used in the Kimi intelligent assistant for uploading files, and it supports the same file formats. These include `.pdf`, `.txt`, `.csv`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`, `.md`, `.jpeg`, `.png`, `.bmp`, `.gif`, `.svg`, `.svgz`, `.webp`, `.ico`, `.xbm`, `.dib`, `.pjp`, `.tif`, `.pjpeg`, `.avif`, `.dot`, `.apng`, `.epub`, `.tiff`, `.jfif`, `.html`, `.json`, `.mobi`, `.log`, `.go`, `.h`, `.c`, `.cpp`, `.cxx`, `.cc`, `.cs`, `.java`, `.js`, `.css`, `.jsp`, `.php`, `.py`, `.py3`, `.asp`, `.yaml`, `.yml`, `.ini`, `.conf`, `.ts`, `.tsx`, etc.

### For File Content Extraction [Permalink for this section](https://platform.moonshot.ai/docs/api/files\#for-file-content-extraction)

> When uploading a file, selecting `purpose="file-extract"` allows the model to obtain information from the file as context.

#### Example Request [Permalink for this section](https://platform.moonshot.ai/docs/api/files\#example-request-1)

pythoncurlnode.js

```
from pathlib import Path
from openai import OpenAI

client = OpenAI(
    api_key = "$MOONSHOT_API_KEY",
    base_url = "https://api.moonshot.ai/v1",
)

# xlnet.pdf is an example file; we support pdf, doc, and image formats. For images and pdf files, we provide OCR capabilities.
file_object = client.files.create(file=Path("xlnet.pdf"), purpose="file-extract")

# Retrieve the result
# file_content = client.files.retrieve_content(file_id=file_object.id)
# Note: The previous retrieve_content API is marked as deprecated in the latest version. You can use the following line instead.
# If you are using an older version, you can use retrieve_content.
file_content = client.files.content(file_id=file_object.id).text

# Include it in the request
messages = [\
    {\
        "role": "system",\
        "content": "You are Kimi, an AI assistant provided by Moonshot AI. You are particularly skilled in Chinese and English conversations. You provide users with safe, helpful, and accurate answers. You will refuse to answer any questions involving terrorism, racism, pornography, or violence. Moonshot AI is a proper noun and should not be translated into other languages.",\
    },\
    {\
        "role": "system",\
        "content": file_content,\
    },\
    {"role": "user", "content": "Please give a brief introduction of what xlnet.pdf is about"},\
]

# Then call chat-completion to get Kimi's response

completion = client.chat.completions.create(
  model="kimi-k2-turbo-preview",
  messages=messages,
  temperature=0.6,
)

print(completion.choices[0].message)
```

Replace the `$MOONSHOT_API_KEY` part with your own API Key. Alternatively, you can set it as an environment variable before making the call.

#### Multi-File Chat Example [Permalink for this section](https://platform.moonshot.ai/docs/api/files\#multi-file-chat-example)

If you want to upload multiple files at once and have a conversation with Kimi based on these files, you can refer to the following example:

```
from typing import *

import os
import json
from pathlib import Path

from openai import OpenAI

client = OpenAI(
    base_url="https://api.moonshot.ai/v1",
    # We will get the value of MOONSHOT_DEMO_API_KEY from the environment variable as the API Key.
    # Please make sure you have correctly set the value of MOONSHOT_DEMO_API_KEY in the environment variable.
    api_key=os.environ["MOONSHOT_DEMO_API_KEY"],
)


def upload_files(files: List[str]) -> List[Dict[str, Any]]:
    """
    upload_files will upload all the files (paths) through the file upload interface '/v1/files' and get the uploaded file content to generate file messages.
    Each file will be an independent message, and the role of these messages will be system. The Kimi large language model will correctly identify the file content in these system messages.

    :param files: A list containing the paths of the files to be uploaded. The paths can be absolute or relative, and please pass the file paths in the form of strings.
    :return: A list of messages containing the file content. Please add these messages to the context, i.e., the messages parameter when requesting the `/v1/chat/completions` interface.
    """
    messages = []

    # For each file path, we will upload the file, extract the file content, and finally generate a message with the role of system, and add it to the final list of messages to be returned.
    for file in files:
        file_object = client.files.create(file=Path(file), purpose="file-extract")
        file_content = client.files.content(file_id=file_object.id).text
        messages.append({
            "role": "system",
            "content": file_content,
        })

    return messages


def main():
    file_messages = upload_files(files=["upload_files.py"])

    messages = [\
        # We use the * syntax to deconstruct the file_messages messages, making them the first N messages in the messages list.\
        *file_messages,\
        {\
            "role": "system",\
            "content": "You are Kimi, an AI assistant provided by Moonshot AI. You are more proficient in Chinese and English conversations. You provide users with safe, helpful, and accurate answers. You will refuse to answer any questions related to terrorism, racism, pornography, or violence. Moonshot AI is a proper noun and should not be translated into other languages.",\
        },\
        {\
            "role": "user",\
            "content": "Summarize the content of these files.",\
        },\
    ]

    print(json.dumps(messages, indent=2, ensure_ascii=False))

    completion = client.chat.completions.create(
        model="kimi-k2-turbo-preview",
        messages=messages,
    )

    print(completion.choices[0].message.content)


if __name__ == '__main__':
    main()
```

### For Image or Video Understanding [Permalink for this section](https://platform.moonshot.ai/docs/api/files\#for-image-or-video-understanding)

> When uploading files, select `purpose="image"` or `purpose="video"`. Uploaded images and videos can be used for native understanding by the model. Please refer to [Using Vision Models](https://platform.moonshot.ai/docs/guide/use-kimi-vision-model.en-US)

## List Files [Permalink for this section](https://platform.moonshot.ai/docs/api/files\#list-files)

> This feature is used to list all the files that a user has uploaded.

### Request Address [Permalink for this section](https://platform.moonshot.ai/docs/api/files\#request-address)

```
GET https://api.moonshot.ai/v1/files
```

### Example Request [Permalink for this section](https://platform.moonshot.ai/docs/api/files\#example-request-2)

#### Python Request [Permalink for this section](https://platform.moonshot.ai/docs/api/files\#python-request)

```
file_list = client.files.list()

for file in file_list.data:
    print(file) # Check the information of each file
```

## Delete File [Permalink for this section](https://platform.moonshot.ai/docs/api/files\#delete-file)

> This feature can be used to delete files that are no longer needed.

### Request Address [Permalink for this section](https://platform.moonshot.ai/docs/api/files\#request-address-1)

```
DELETE https://api.moonshot.ai/v1/files/{file_id}
```

### Example Request [Permalink for this section](https://platform.moonshot.ai/docs/api/files\#example-request-3)

#### Python Request [Permalink for this section](https://platform.moonshot.ai/docs/api/files\#python-request-1)

```
client.files.delete(file_id=file_id)
```

## Get File Information [Permalink for this section](https://platform.moonshot.ai/docs/api/files\#get-file-information)

> This feature is used to obtain the basic information of a specified file.

### Request Address [Permalink for this section](https://platform.moonshot.ai/docs/api/files\#request-address-2)

```
GET https://api.moonshot.ai/v1/files/{file_id}
```

### Example Request [Permalink for this section](https://platform.moonshot.ai/docs/api/files\#example-request-4)

#### Python Request [Permalink for this section](https://platform.moonshot.ai/docs/api/files\#python-request-2)

```
client.files.retrieve(file_id=file_id)
# FileObject(
#     id='clg681objj8g9m7n4je0',
#     bytes=761790,
#     created_at=1700815879,
#     filename='xlnet.pdf',
#     object='file',
#     purpose='file-extract',
#     status='ok', status_details='') # If status is error, extraction has failed
```

## Get File Content [Permalink for this section](https://platform.moonshot.ai/docs/api/files\#get-file-content)

> This feature can retrieve the extraction results for files with the purpose of "file content extraction".
> Typically, it is a valid JSON formatted string and aligns with our recommended format.
> If you need to extract multiple files, you can concatenate them into a large string separated by newline characters \\n in a message, and add them to the history with the role set to system.

### Request Address [Permalink for this section](https://platform.moonshot.ai/docs/api/files\#request-address-3)

```
GET https://api.moonshot.ai/v1/files/{file_id}/content
```

### Example Request [Permalink for this section](https://platform.moonshot.ai/docs/api/files\#example-request-5)

pythoncurl

```
# file_content = client.files.retrieve_content(file_id=file_object.id)
# The type of file_content is `str`
# Note: The previous retrieve_content API is marked with a warning in the latest version. You can use the following line instead.
# If you are using an older version, you can use retrieve_content.
file_content = client.files.content(file_id=file_object.id).text
# Our output is currently a JSON in an internally agreed format, but it should be placed in the message as text.
```

Last updated on January 26, 2026

# Estimate Tokens

This API is used to calculate the token count for a request (including both plain text input and visual input).

## Request Address [Permalink for this section](https://platform.moonshot.ai/docs/api/estimate\#request-address)

```
POST https://api.moonshot.ai/v1/tokenizers/estimate-token-count
```

## Request Content [Permalink for this section](https://platform.moonshot.ai/docs/api/estimate\#request-content)

The input structure for `estimate-token-count` is almost identical to that of `chat completion`.

## Example [Permalink for this section](https://platform.moonshot.ai/docs/api/estimate\#example)

```
{
    "model": "kimi-k2-turbo-preview",
    "messages": [\
        {\
            "role": "system",\
            "content": "You are Kimi, an AI assistant provided by Moonshot AI. You excel in Chinese and English conversations. You provide users with safe, helpful, and accurate answers. You refuse to answer any questions involving terrorism, racism, pornography, or violence. Moonshot AI is a proper noun and should not be translated into other languages."\
        },\
        { "role": "user", "content": "Hello, my name is Li Lei. What is 1+1?" }\
    ]
}
```

## Parameters [Permalink for this section](https://platform.moonshot.ai/docs/api/estimate\#parameters)

| Field | Description | Type | Values |
| --- | --- | --- | --- |
| messages | A list of messages in the conversation so far. | List\[Dict\] | This is a list of structures, with each element similar to: `json{"role": "user", "content": "Hello"}` The role can only be one of `system`, `user`, `assistant`, and the content must not be empty |
| model | Model ID, which can be obtained through List Models | string | Currently one of `kimi-k2.5`, `kimi-k2-0905-preview`,`kimi-k2-0711-preview`, `kimi-k2-turbo-preview`,`moonshot-v1-8k`,`moonshot-v1-32k`,`moonshot-v1-128k`, `moonshot-v1-auto`,`kimi-latest`,`moonshot-v1-8k-vision-preview`,`moonshot-v1-32k-vision-preview`,`moonshot-v1-128k-vision-preview` |

## Example Request [Permalink for this section](https://platform.moonshot.ai/docs/api/estimate\#example-request)

```
curl 'https://api.moonshot.ai/v1/tokenizers/estimate-token-count' \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MOONSHOT_API_KEY" \
  -d '{
    "model": "kimi-k2.5",
    "messages": [\
        {\
            "role": "system",\
            "content": "You are Kimi, an AI assistant provided by Moonshot AI. You excel in Chinese and English conversations. You provide users with safe, helpful, and accurate answers. You refuse to answer any questions involving terrorism, racism, pornography, or violence. Moonshot AI is a proper noun and should not be translated into other languages."\
        },\
        {\
            "role": "user",\
            "content": "Hello, my name is Li Lei. What is 1+1?"\
        }\
    ]
}'
```

- Visual input request

```
import os
import base64
import json
import requests

api_key = os.environ.get("MOONSHOT_API_KEY")
endpoint = "https://api.moonshot.ai/v1/tokenizers/estimate-token-count"
image_path = "image.png"

with open(image_path, "rb") as f:
    image_data = f.read()

# We use the built-in base64.b64encode function to encode the image into a base64 formatted image_url
image_url = f"data:image/{os.path.splitext(image_path)[1]};base64,{base64.b64encode(image_data).decode('utf-8')}"

payload = {
    "model": "kimi-k2.5",
    "messages": [\
        {\
            "role": "system",\
            "content": "You are Kimi, an AI assistant provided by Moonshot AI. You excel in Chinese and English conversations. You provide users with safe, helpful, and accurate answers. You refuse to answer any questions involving terrorism, racism, pornography, or violence. Moonshot AI is a proper noun and should not be translated into other languages."\
        },\
        {\
            "role": "user",\
            "content": [\
                {\
                    "type": "image_url", # <-- Use the image_url type to upload the image, the content is the base64 encoded image\
                    "image_url": {\
                        "url": image_url,\
                    },\
                },\
                {\
                    "type": "text",\
                    "text": "Please describe the content of this image.", # <-- Use the text type to provide text instructions, such as "Describe the image content"\
                },\
            ],\
        }\
    ]
}

response = requests.post(
    endpoint,
    headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    },
    data=json.dumps(payload)
)

print(response.json())
```

## Response [Permalink for this section](https://platform.moonshot.ai/docs/api/estimate\#response)

```
{
    "data": {
        "total_tokens": 80
    }
}
```

If there is no `error` field, you can take `data.total_tokens` as the calculation result.

Last updated on January 26, 2026

[Skip to main content](https://api-docs.deepseek.com/#__docusaurus_skipToContent_fallback)

[![DeepSeek API Docs Logo](https://cdn.deepseek.com/platform/favicon.png)\\
**DeepSeek API Docs**](https://api-docs.deepseek.com/)

[English](https://api-docs.deepseek.com/#)

- [English](https://api-docs.deepseek.com/)
- [中文（中国）](https://api-docs.deepseek.com/zh-cn/)

[DeepSeek Platform](https://platform.deepseek.com/)

- [Quick Start](https://api-docs.deepseek.com/#)

  - [Your First API Call](https://api-docs.deepseek.com/)
  - [Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing)
  - [The Temperature Parameter](https://api-docs.deepseek.com/quick_start/parameter_settings)
  - [Token & Token Usage](https://api-docs.deepseek.com/quick_start/token_usage)
  - [Rate Limit](https://api-docs.deepseek.com/quick_start/rate_limit)
  - [Error Codes](https://api-docs.deepseek.com/quick_start/error_codes)
- [News](https://api-docs.deepseek.com/#)

  - [DeepSeek-V3.2 Release 2025/12/01](https://api-docs.deepseek.com/news/news251201)
  - [DeepSeek-V3.2-Exp Release 2025/09/29](https://api-docs.deepseek.com/news/news250929)
  - [DeepSeek V3.1 Update 2025/09/22](https://api-docs.deepseek.com/news/news250922)
  - [DeepSeek V3.1 Release 2025/08/21](https://api-docs.deepseek.com/news/news250821)
  - [DeepSeek-R1-0528 Release 2025/05/28](https://api-docs.deepseek.com/news/news250528)
  - [DeepSeek-V3-0324 Release 2025/03/25](https://api-docs.deepseek.com/news/news250325)
  - [DeepSeek-R1 Release 2025/01/20](https://api-docs.deepseek.com/news/news250120)
  - [DeepSeek APP 2025/01/15](https://api-docs.deepseek.com/news/news250115)
  - [Introducing DeepSeek-V3 2024/12/26](https://api-docs.deepseek.com/news/news1226)
  - [DeepSeek-V2.5-1210 Release 2024/12/10](https://api-docs.deepseek.com/news/news1210)
  - [DeepSeek-R1-Lite Release 2024/11/20](https://api-docs.deepseek.com/news/news1120)
  - [DeepSeek-V2.5 Release 2024/09/05](https://api-docs.deepseek.com/news/news0905)
  - [Context Caching is Available 2024/08/02](https://api-docs.deepseek.com/news/news0802)
  - [New API Features 2024/07/25](https://api-docs.deepseek.com/news/news0725)
- [API Reference](https://api-docs.deepseek.com/#)

- [API Guides](https://api-docs.deepseek.com/#)

  - [Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode)
  - [Multi-round Conversation](https://api-docs.deepseek.com/guides/multi_round_chat)
  - [Chat Prefix Completion (Beta)](https://api-docs.deepseek.com/guides/chat_prefix_completion)
  - [FIM Completion (Beta)](https://api-docs.deepseek.com/guides/fim_completion)
  - [JSON Output](https://api-docs.deepseek.com/guides/json_mode)
  - [Tool Calls](https://api-docs.deepseek.com/guides/tool_calls)
  - [Context Caching](https://api-docs.deepseek.com/guides/kv_cache)
  - [Anthropic API](https://api-docs.deepseek.com/guides/anthropic_api)
- [Other Resources](https://api-docs.deepseek.com/#)

  - [Integrations](https://github.com/deepseek-ai/awesome-deepseek-integration/tree/main)
  - [API Status Page](https://status.deepseek.com/)
- [FAQ](https://api-docs.deepseek.com/faq)
- [Change Log](https://api-docs.deepseek.com/updates)

- [Home page](https://api-docs.deepseek.com/)
- Quick Start
- Your First API Call

On this page

# Your First API Call

The DeepSeek API uses an API format compatible with OpenAI. By modifying the configuration, you can use the OpenAI SDK or softwares compatible with the OpenAI API to access the DeepSeek API.

| PARAM | VALUE |
| --- | --- |
| base\_url \* | `https://api.deepseek.com` |
| api\_key | apply for an [API key](https://platform.deepseek.com/api_keys) |

\\* To be compatible with OpenAI, you can also use `https://api.deepseek.com/v1` as the `base_url`. But note that the `v1` here has NO relationship with the model's version.

\\* **`deepseek-chat` and `deepseek-reasoner` are upgraded to DeepSeek-V3.2 now.**`deepseek-chat` is the **non-thinking mode** of DeepSeek-V3.2 and `deepseek-reasoner` is the **thinking mode** of DeepSeek-V3.2.

## Invoke The Chat API [​](https://api-docs.deepseek.com/\#invoke-the-chat-api "Direct link to Invoke The Chat API")

Once you have obtained an API key, you can access the DeepSeek API using the following example scripts. This is a non-stream example, you can set the `stream` parameter to `true` to get stream response.

- nodejs

```javascript
// Please install OpenAI SDK first: `npm install openai`

import OpenAI from "openai";

const openai = new OpenAI({
        baseURL: 'https://api.deepseek.com',
        apiKey: process.env.DEEPSEEK_API_KEY,
});

async function main() {
  const completion = await openai.chat.completions.create({
    messages: [{ role: "system", content: "You are a helpful assistant." }],
    model: "deepseek-chat",
  });

  console.log(completion.choices[0].message.content);
}

main();
```

[Skip to main content](https://api-docs.deepseek.com/guides/thinking_mode#__docusaurus_skipToContent_fallback)

[![DeepSeek API Docs Logo](https://cdn.deepseek.com/platform/favicon.png)![DeepSeek API Docs Logo](https://cdn.deepseek.com/platform/favicon.png)\\
**DeepSeek API Docs**](https://api-docs.deepseek.com/)

[English](https://api-docs.deepseek.com/guides/thinking_mode#)

- [English](https://api-docs.deepseek.com/guides/thinking_mode)
- [中文（中国）](https://api-docs.deepseek.com/zh-cn/guides/thinking_mode)

[DeepSeek Platform](https://platform.deepseek.com/)

- [Quick Start](https://api-docs.deepseek.com/)

  - [Your First API Call](https://api-docs.deepseek.com/)
  - [Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing)
  - [The Temperature Parameter](https://api-docs.deepseek.com/quick_start/parameter_settings)
  - [Token & Token Usage](https://api-docs.deepseek.com/quick_start/token_usage)
  - [Rate Limit](https://api-docs.deepseek.com/quick_start/rate_limit)
  - [Error Codes](https://api-docs.deepseek.com/quick_start/error_codes)
- [News](https://api-docs.deepseek.com/news/news251201)

  - [DeepSeek-V3.2 Release 2025/12/01](https://api-docs.deepseek.com/news/news251201)
  - [DeepSeek-V3.2-Exp Release 2025/09/29](https://api-docs.deepseek.com/news/news250929)
  - [DeepSeek V3.1 Update 2025/09/22](https://api-docs.deepseek.com/news/news250922)
  - [DeepSeek V3.1 Release 2025/08/21](https://api-docs.deepseek.com/news/news250821)
  - [DeepSeek-R1-0528 Release 2025/05/28](https://api-docs.deepseek.com/news/news250528)
  - [DeepSeek-V3-0324 Release 2025/03/25](https://api-docs.deepseek.com/news/news250325)
  - [DeepSeek-R1 Release 2025/01/20](https://api-docs.deepseek.com/news/news250120)
  - [DeepSeek APP 2025/01/15](https://api-docs.deepseek.com/news/news250115)
  - [Introducing DeepSeek-V3 2024/12/26](https://api-docs.deepseek.com/news/news1226)
  - [DeepSeek-V2.5-1210 Release 2024/12/10](https://api-docs.deepseek.com/news/news1210)
  - [DeepSeek-R1-Lite Release 2024/11/20](https://api-docs.deepseek.com/news/news1120)
  - [DeepSeek-V2.5 Release 2024/09/05](https://api-docs.deepseek.com/news/news0905)
  - [Context Caching is Available 2024/08/02](https://api-docs.deepseek.com/news/news0802)
  - [New API Features 2024/07/25](https://api-docs.deepseek.com/news/news0725)
- [API Reference](https://api-docs.deepseek.com/api/deepseek-api)

- [API Guides](https://api-docs.deepseek.com/guides/thinking_mode)

  - [Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode)
  - [Multi-round Conversation](https://api-docs.deepseek.com/guides/multi_round_chat)
  - [Chat Prefix Completion (Beta)](https://api-docs.deepseek.com/guides/chat_prefix_completion)
  - [FIM Completion (Beta)](https://api-docs.deepseek.com/guides/fim_completion)
  - [JSON Output](https://api-docs.deepseek.com/guides/json_mode)
  - [Tool Calls](https://api-docs.deepseek.com/guides/tool_calls)
  - [Context Caching](https://api-docs.deepseek.com/guides/kv_cache)
  - [Anthropic API](https://api-docs.deepseek.com/guides/anthropic_api)
- [Other Resources](https://github.com/deepseek-ai/awesome-deepseek-integration/tree/main)

  - [Integrations](https://github.com/deepseek-ai/awesome-deepseek-integration/tree/main)
  - [API Status Page](https://status.deepseek.com/)
- [FAQ](https://api-docs.deepseek.com/faq)
- [Change Log](https://api-docs.deepseek.com/updates)

- [Home page](https://api-docs.deepseek.com/)
- API Guides
- Thinking Mode

On this page

# Thinking Mode

The DeepSeek model supports the thinking mode: before outputting the final answer, the model will first output a chain-of-thought reasoning to improve the accuracy of the final response. You can enable thinking mode using any of the following methods:

1. Set the `model` parameter: `"model": "deepseek-reasoner"`

2. Set the `thinking` parameter: `"thinking": {"type": "enabled"}`


If you are using the OpenAI SDK, when setting `thinking` parameter, you need to pass the `thinking` parameter within `extra_body`:

```python
response = client.chat.completions.create(
  model="deepseek-chat",
  # ...
  extra_body={"thinking": {"type": "enabled"}}
)
```

## API Parameters [​](https://api-docs.deepseek.com/guides/thinking_mode\#api-parameters "Direct link to API Parameters")

- **Input**：
  - `max_tokens`：The maximum output length (including the COT part). Default to 32K, maximum to 64K.
- **Output**：
  - `reasoning_content`：The content of the CoT，which is at the same level as `content` in the output structure. See [API Example](https://api-docs.deepseek.com/guides/thinking_mode#api-example) for details.
  - `content`: The content of the final answer.
  - `tool_calls`: The tool calls.
- **Supported Features**： [Json Output](https://api-docs.deepseek.com/guides/json_mode)、 [Tool Calls](https://api-docs.deepseek.com/guides/tool_calls)、 [Chat Completion](https://api-docs.deepseek.com/api/create-chat-completion)、 [Chat Prefix Completion (Beta)](https://api-docs.deepseek.com/guides/chat_prefix_completion)

- **Not Supported Features**：FIM (Beta)

- **Not Supported Parameters**：`temperature`、`top_p`、`presence_penalty`、`frequency_penalty`、`logprobs`、`top_logprobs`. Please note that to ensure compatibility with existing software, setting `temperature`、`top_p`、`presence_penalty`、`frequency_penalty` will not trigger an error but will also have no effect. Setting `logprobs`、`top_logprobs` will trigger an error.


## Multi-turn Conversation [​](https://api-docs.deepseek.com/guides/thinking_mode\#multi-turn-conversation "Direct link to Multi-turn Conversation")

In each turn of the conversation, the model outputs the CoT (`reasoning_content`) and the final answer (`content`). In the next turn of the conversation, the CoT from previous turns is not concatenated into the context, as illustrated in the following diagram:

![](https://api-docs.deepseek.com/img/deepseek_r1_multiround_example_en.jpeg)

## API Example [​](https://api-docs.deepseek.com/guides/thinking_mode\#api-example "Direct link to API Example")

The following code, using Python as an example, demonstrates how to access the CoT and the final answer, as well as how to conduct multi-turn conversations. Note that in the code for the new turn of conversation, only the `content` from the previous turn's output is passed, while the `reasoning_content` is ignored.

- NoStreaming
- Streaming

```python
from openai import OpenAI
client = OpenAI(api_key="<DeepSeek API Key>", base_url="https://api.deepseek.com")

# Turn 1
messages = [{"role": "user", "content": "9.11 and 9.8, which is greater?"}]
response = client.chat.completions.create(
    model="deepseek-reasoner",
    messages=messages
)

reasoning_content = response.choices[0].message.reasoning_content
content = response.choices[0].message.content

# Turn 2
messages.append({'role': 'assistant', 'content': content})
messages.append({'role': 'user', 'content': "How many Rs are there in the word 'strawberry'?"})
response = client.chat.completions.create(
    model="deepseek-reasoner",
    messages=messages
)
# ...
```

```python
from openai import OpenAI
client = OpenAI(api_key="<DeepSeek API Key>", base_url="https://api.deepseek.com")

# Turn 1
messages = [{"role": "user", "content": "9.11 and 9.8, which is greater?"}]
response = client.chat.completions.create(
    model="deepseek-reasoner",
    messages=messages,
    stream=True
)

reasoning_content = ""
content = ""

for chunk in response:
    if chunk.choices[0].delta.reasoning_content:
        reasoning_content += chunk.choices[0].delta.reasoning_content
    else:
        content += chunk.choices[0].delta.content

# Turn 2
messages.append({"role": "assistant", "content": content})
messages.append({'role': 'user', 'content': "How many Rs are there in the word 'strawberry'?"})
response = client.chat.completions.create(
    model="deepseek-reasoner",
    messages=messages,
    stream=True
)
# ...
```

## Tool Calls [​](https://api-docs.deepseek.com/guides/thinking_mode\#tool-calls "Direct link to Tool Calls")

DeepSeek model's thinking mode now supports tool calls. Before outputting the final answer, the model can engage in multiple turns of reasoning and tool calls to improve the quality of the response. The calling pattern is illustrated below:

![](https://api-docs.deepseek.com/img/v3.2_thinking_with_tools_en.jpeg)

- During the process of answering question 1 (Turn 1.1 - 1.3), the model performed multiple turns of thinking + tool calls before providing the answer. During this process, the user needs to send the reasoning content (`reasoning_content`) back to the API to allow the model to continue reasoning.

- When the next user question begins (Turn 2.1), the previous `reasoning_content` should be removed, while keeping other elements to send to the API. If `reasoning_content` is retained and sent to the API, the API will ignore it.


### Compatibility Notice [​](https://api-docs.deepseek.com/guides/thinking_mode\#compatibility-notice "Direct link to Compatibility Notice")

Since the tool invocation process in thinking mode requires users to pass back `reasoning_content` to the API, if your code does not correctly pass back `reasoning_content`, the API will return a 400 error. Please refer to the sample code below for the correct way.

### Sample Code [​](https://api-docs.deepseek.com/guides/thinking_mode\#sample-code "Direct link to Sample Code")

Below is a simple sample code for tool calls in thinking mode:

```python
import os
import json
from openai import OpenAI

# The definition of the tools
tools = [\
    {\
        "type": "function",\
        "function": {\
            "name": "get_date",\
            "description": "Get the current date",\
            "parameters": { "type": "object", "properties": {} },\
        }\
    },\
    {\
        "type": "function",\
        "function": {\
            "name": "get_weather",\
            "description": "Get weather of a location, the user should supply the location and date.",\
            "parameters": {\
                "type": "object",\
                "properties": {\
                    "location": { "type": "string", "description": "The city name" },\
                    "date": { "type": "string", "description": "The date in format YYYY-mm-dd" },\
                },\
                "required": ["location", "date"]\
            },\
        }\
    },\
]

# The mocked version of the tool calls
def get_date_mock():
    return "2025-12-01"

def get_weather_mock(location, date):
    return "Cloudy 7~13°C"

TOOL_CALL_MAP = {
    "get_date": get_date_mock,
    "get_weather": get_weather_mock
}

def clear_reasoning_content(messages):
    for message in messages:
        if hasattr(message, 'reasoning_content'):
            message.reasoning_content = None

def run_turn(turn, messages):
    sub_turn = 1
    while True:
        response = client.chat.completions.create(
            model='deepseek-chat',
            messages=messages,
            tools=tools,
            extra_body={ "thinking": { "type": "enabled" } }
        )
        messages.append(response.choices[0].message)
        reasoning_content = response.choices[0].message.reasoning_content
        content = response.choices[0].message.content
        tool_calls = response.choices[0].message.tool_calls
        print(f"Turn {turn}.{sub_turn}\n{reasoning_content=}\n{content=}\n{tool_calls=}")
        # If there is no tool calls, then the model should get a final answer and we need to stop the loop
        if tool_calls is None:
            break
        for tool in tool_calls:
            tool_function = TOOL_CALL_MAP[tool.function.name]
            tool_result = tool_function(**json.loads(tool.function.arguments))
            print(f"tool result for {tool.function.name}: {tool_result}\n")
            messages.append({
                "role": "tool",
                "tool_call_id": tool.id,
                "content": tool_result,
            })
        sub_turn += 1

client = OpenAI(
    api_key=os.environ.get('DEEPSEEK_API_KEY'),
    base_url=os.environ.get('DEEPSEEK_BASE_URL'),
)

# The user starts a question
turn = 1
messages = [{\
    "role": "user",\
    "content": "How's the weather in Hangzhou Tomorrow"\
}]
run_turn(turn, messages)

# The user starts a new question
turn = 2
messages.append({
    "role": "user",
    "content": "How's the weather in Hangzhou Tomorrow"
})
# We recommended to clear the reasoning_content in history messages so as to save network bandwidth
clear_reasoning_content(messages)
run_turn(turn, messages)
```

In each sub-request of Turn 1, the `reasoning_content` generated during that turn is sent to the API, allowing the model to continue its previous reasoning. `response.choices[0].message` contains all necessary fields for the `assistant` message, including `content`, `reasoning_content`, and `tool_calls`. For simplicity, you can directly append the message to the end of the messages list using the following code:

```python
messages.append(response.choices[0].message)
```

This line of code is equivalent to:

```text
messages.append({
    'role': 'assistant',
    'content': response.choices[0].message.content,
    'reasoning_content': response.choices[0].message.reasoning_content,
    'tool_calls': response.choices[0].message.tool_calls,
})
```

At the beginning of Turn 2, we recommend discarding the `reasoning_content` from previous turns to save network bandwidth:

```python
clear_reasoning_content(messages)
```

The sample output of this code is as follows:

```bash
Turn 1.1
reasoning_content="The user is asking about the weather in Hangzhou tomorrow. I need to get the current date first, then calculate tomorrow's date, and then call the weather API. Let me start by getting the current date."
content=''
tool_calls=[ChatCompletionMessageToolCall(id='call_00_Tcek83ZQ4fFb1RfPQnsPEE5w', function=Function(arguments='{}', name='get_date'), type='function', index=0)]
tool_result(get_date): 2025-12-01

Turn 1.2
reasoning_content='Today is December 1, 2025. Tomorrow is December 2, 2025. I need to format the date as YYYY-mm-dd: "2025-12-02". Now I can call get_weather with location Hangzhou and date 2025-12-02.'
content=''
tool_calls=[ChatCompletionMessageToolCall(id='call_00_V0Uwt4i63m5QnWRS1q1AO1tP', function=Function(arguments='{"location": "Hangzhou", "date": "2025-12-02"}', name='get_weather'), type='function', index=0)]
tool_result(get_weather): Cloudy 7~13°C

Turn 1.3
reasoning_content="I have the weather information: Cloudy with temperatures between 7 and 13°C. I should respond in a friendly, helpful manner. I'll mention that it's for tomorrow (December 2, 2025) and give the details. I can also ask if they need any other information. Let's craft the response."
content="Tomorrow (Tuesday, December 2, 2025) in Hangzhou will be **cloudy** with temperatures ranging from **7°C to 13°C**.  \n\nIt might be a good idea to bring a light jacket if you're heading out. Is there anything else you'd like to know about the weather?"
tool_calls=None

Turn 2.1
reasoning_content="The user wants clothing advice for tomorrow based on the weather in Hangzhou. I know tomorrow's weather: cloudy, 7-13°C. That's cool but not freezing. I should suggest layered clothing, maybe a jacket, long pants, etc. I can also mention that since it's cloudy, an umbrella might not be needed unless there's rain chance, but the forecast didn't mention rain. I should be helpful and give specific suggestions. I can also ask if they have any specific activities planned to tailor the advice. Let me respond."
content="Based on tomorrow's forecast of **cloudy weather with temperatures between 7°C and 13°C** in Hangzhou, here are some clothing suggestions:\n\n**Recommended outfit:**\n- **Upper body:** A long-sleeve shirt or sweater, plus a light to medium jacket (like a fleece, windbreaker, or light coat)\n- **Lower body:** Long pants or jeans\n- **Footwear:** Closed-toe shoes or sneakers\n- **Optional:** A scarf or light hat for extra warmth, especially in the morning and evening\n\n**Why this works:**\n- The temperature range is cool but not freezing, so layering is key\n- Since it's cloudy but no rain mentioned, you likely won't need an umbrella\n- The jacket will help with the morning chill (7°C) and can be removed if you warm up during the day\n\n**If you have specific plans:**\n- For outdoor activities: Consider adding an extra layer\n- For indoor/office settings: The layered approach allows you to adjust comfortably\n\nWould you like more specific advice based on your planned activities?"
tool_calls=None
```

[Skip to main content](https://api-docs.deepseek.com/guides/multi_round_chat#__docusaurus_skipToContent_fallback)

[![DeepSeek API Docs Logo](https://cdn.deepseek.com/platform/favicon.png)\\
**DeepSeek API Docs**](https://api-docs.deepseek.com/)

[English](https://api-docs.deepseek.com/guides/multi_round_chat#)

- [English](https://api-docs.deepseek.com/guides/multi_round_chat)
- [中文（中国）](https://api-docs.deepseek.com/zh-cn/guides/multi_round_chat)

[DeepSeek Platform](https://platform.deepseek.com/)

- [Quick Start](https://api-docs.deepseek.com/guides/multi_round_chat#)

  - [Your First API Call](https://api-docs.deepseek.com/)
  - [Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing)
  - [The Temperature Parameter](https://api-docs.deepseek.com/quick_start/parameter_settings)
  - [Token & Token Usage](https://api-docs.deepseek.com/quick_start/token_usage)
  - [Rate Limit](https://api-docs.deepseek.com/quick_start/rate_limit)
  - [Error Codes](https://api-docs.deepseek.com/quick_start/error_codes)
- [News](https://api-docs.deepseek.com/guides/multi_round_chat#)

  - [DeepSeek-V3.2 Release 2025/12/01](https://api-docs.deepseek.com/news/news251201)
  - [DeepSeek-V3.2-Exp Release 2025/09/29](https://api-docs.deepseek.com/news/news250929)
  - [DeepSeek V3.1 Update 2025/09/22](https://api-docs.deepseek.com/news/news250922)
  - [DeepSeek V3.1 Release 2025/08/21](https://api-docs.deepseek.com/news/news250821)
  - [DeepSeek-R1-0528 Release 2025/05/28](https://api-docs.deepseek.com/news/news250528)
  - [DeepSeek-V3-0324 Release 2025/03/25](https://api-docs.deepseek.com/news/news250325)
  - [DeepSeek-R1 Release 2025/01/20](https://api-docs.deepseek.com/news/news250120)
  - [DeepSeek APP 2025/01/15](https://api-docs.deepseek.com/news/news250115)
  - [Introducing DeepSeek-V3 2024/12/26](https://api-docs.deepseek.com/news/news1226)
  - [DeepSeek-V2.5-1210 Release 2024/12/10](https://api-docs.deepseek.com/news/news1210)
  - [DeepSeek-R1-Lite Release 2024/11/20](https://api-docs.deepseek.com/news/news1120)
  - [DeepSeek-V2.5 Release 2024/09/05](https://api-docs.deepseek.com/news/news0905)
  - [Context Caching is Available 2024/08/02](https://api-docs.deepseek.com/news/news0802)
  - [New API Features 2024/07/25](https://api-docs.deepseek.com/news/news0725)
- [API Reference](https://api-docs.deepseek.com/guides/multi_round_chat#)

- [API Guides](https://api-docs.deepseek.com/guides/multi_round_chat#)

  - [Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode)
  - [Multi-round Conversation](https://api-docs.deepseek.com/guides/multi_round_chat)
  - [Chat Prefix Completion (Beta)](https://api-docs.deepseek.com/guides/chat_prefix_completion)
  - [FIM Completion (Beta)](https://api-docs.deepseek.com/guides/fim_completion)
  - [JSON Output](https://api-docs.deepseek.com/guides/json_mode)
  - [Tool Calls](https://api-docs.deepseek.com/guides/tool_calls)
  - [Context Caching](https://api-docs.deepseek.com/guides/kv_cache)
  - [Anthropic API](https://api-docs.deepseek.com/guides/anthropic_api)
- [Other Resources](https://api-docs.deepseek.com/guides/multi_round_chat#)

  - [Integrations](https://github.com/deepseek-ai/awesome-deepseek-integration/tree/main)
  - [API Status Page](https://status.deepseek.com/)
- [FAQ](https://api-docs.deepseek.com/faq)
- [Change Log](https://api-docs.deepseek.com/updates)

- [Home page](https://api-docs.deepseek.com/)
- API Guides
- Multi-round Conversation

# Multi-round Conversation

This guide will introduce how to use the DeepSeek `/chat/completions` API for multi-turn conversations.

The DeepSeek `/chat/completions` API is a "stateless" API, meaning the server does not record the context of the user's requests. Therefore, the user must **concatenate all previous conversation history** and pass it to the chat API with each request.

The following code in Python demonstrates how to concatenate context to achieve multi-turn conversations.

```python
from openai import OpenAI
client = OpenAI(api_key="<DeepSeek API Key>", base_url="https://api.deepseek.com")

# Round 1
messages = [{"role": "user", "content": "What's the highest mountain in the world?"}]
response = client.chat.completions.create(
    model="deepseek-chat",
    messages=messages
)

messages.append(response.choices[0].message)
print(f"Messages Round 1: {messages}")

# Round 2
messages.append({"role": "user", "content": "What is the second?"})
response = client.chat.completions.create(
    model="deepseek-chat",
    messages=messages
)

messages.append(response.choices[0].message)
print(f"Messages Round 2: {messages}")
```

* * *

In the **first round** of the request, the `messages` passed to the API are:

```json
[\
    {"role": "user", "content": "What's the highest mountain in the world?"}\
]
```

In the **second round** of the request:

1. Add the model's output from the first round to the end of the `messages`.
2. Add the new question to the end of the `messages`.

The `messages` ultimately passed to the API are:

```json
[\
    {"role": "user", "content": "What's the highest mountain in the world?"},\
    {"role": "assistant", "content": "The highest mountain in the world is Mount Everest."},\
    {"role": "user", "content": "What is the second?"}\
]
```

[Skip to main content](https://api-docs.deepseek.com/guides/kv_cache#__docusaurus_skipToContent_fallback)

[![DeepSeek API Docs Logo](https://cdn.deepseek.com/platform/favicon.png)\\
**DeepSeek API Docs**](https://api-docs.deepseek.com/)

[English](https://api-docs.deepseek.com/guides/kv_cache#)

- [English](https://api-docs.deepseek.com/guides/kv_cache)
- [中文（中国）](https://api-docs.deepseek.com/zh-cn/guides/kv_cache)

[DeepSeek Platform](https://platform.deepseek.com/)

- [Quick Start](https://api-docs.deepseek.com/guides/kv_cache#)

  - [Your First API Call](https://api-docs.deepseek.com/)
  - [Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing)
  - [The Temperature Parameter](https://api-docs.deepseek.com/quick_start/parameter_settings)
  - [Token & Token Usage](https://api-docs.deepseek.com/quick_start/token_usage)
  - [Rate Limit](https://api-docs.deepseek.com/quick_start/rate_limit)
  - [Error Codes](https://api-docs.deepseek.com/quick_start/error_codes)
- [News](https://api-docs.deepseek.com/guides/kv_cache#)

  - [DeepSeek-V3.2 Release 2025/12/01](https://api-docs.deepseek.com/news/news251201)
  - [DeepSeek-V3.2-Exp Release 2025/09/29](https://api-docs.deepseek.com/news/news250929)
  - [DeepSeek V3.1 Update 2025/09/22](https://api-docs.deepseek.com/news/news250922)
  - [DeepSeek V3.1 Release 2025/08/21](https://api-docs.deepseek.com/news/news250821)
  - [DeepSeek-R1-0528 Release 2025/05/28](https://api-docs.deepseek.com/news/news250528)
  - [DeepSeek-V3-0324 Release 2025/03/25](https://api-docs.deepseek.com/news/news250325)
  - [DeepSeek-R1 Release 2025/01/20](https://api-docs.deepseek.com/news/news250120)
  - [DeepSeek APP 2025/01/15](https://api-docs.deepseek.com/news/news250115)
  - [Introducing DeepSeek-V3 2024/12/26](https://api-docs.deepseek.com/news/news1226)
  - [DeepSeek-V2.5-1210 Release 2024/12/10](https://api-docs.deepseek.com/news/news1210)
  - [DeepSeek-R1-Lite Release 2024/11/20](https://api-docs.deepseek.com/news/news1120)
  - [DeepSeek-V2.5 Release 2024/09/05](https://api-docs.deepseek.com/news/news0905)
  - [Context Caching is Available 2024/08/02](https://api-docs.deepseek.com/news/news0802)
  - [New API Features 2024/07/25](https://api-docs.deepseek.com/news/news0725)
- [API Reference](https://api-docs.deepseek.com/guides/kv_cache#)

- [API Guides](https://api-docs.deepseek.com/guides/kv_cache#)

  - [Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode)
  - [Multi-round Conversation](https://api-docs.deepseek.com/guides/multi_round_chat)
  - [Chat Prefix Completion (Beta)](https://api-docs.deepseek.com/guides/chat_prefix_completion)
  - [FIM Completion (Beta)](https://api-docs.deepseek.com/guides/fim_completion)
  - [JSON Output](https://api-docs.deepseek.com/guides/json_mode)
  - [Tool Calls](https://api-docs.deepseek.com/guides/tool_calls)
  - [Context Caching](https://api-docs.deepseek.com/guides/kv_cache)
  - [Anthropic API](https://api-docs.deepseek.com/guides/anthropic_api)
- [Other Resources](https://api-docs.deepseek.com/guides/kv_cache#)

  - [Integrations](https://github.com/deepseek-ai/awesome-deepseek-integration/tree/main)
  - [API Status Page](https://status.deepseek.com/)
- [FAQ](https://api-docs.deepseek.com/faq)
- [Change Log](https://api-docs.deepseek.com/updates)

- [Home page](https://api-docs.deepseek.com/)
- API Guides
- Context Caching

On this page

# Context Caching

The DeepSeek API [Context Caching on Disk Technology](https://api-docs.deepseek.com/news/news0802) is enabled by default for all users, allowing them to benefit without needing to modify their code.

Each user request will trigger the construction of a hard disk cache. If subsequent requests have overlapping prefixes with previous requests, the overlapping part will only be fetched from the cache, which counts as a "cache hit."

Note: Between two requests, only the repeated **prefix** part can trigger a "cache hit." Please refer to the example below for more details.

* * *

## Example 1: Long Text Q&A [​](https://api-docs.deepseek.com/guides/kv_cache\#example-1-long-text-qa "Direct link to Example 1: Long Text Q&A")

**First Request**

```json
messages: [\
    {"role": "system", "content": "You are an experienced financial report analyst..."}\
    {"role": "user", "content": "<financial report content>\n\nPlease summarize the key information of this financial report."}\
]
```

**Second Request**

```json
messages: [\
    {"role": "system", "content": "You are an experienced financial report analyst..."}\
    {"role": "user", "content": "<financial report content>\n\nPlease analyze the profitability of this financial report."}\
]
```

In the above example, both requests have the same **prefix**, which is the `system` message + `<financial report content>` in the `user` message. During the second request, this prefix part will count as a "cache hit."

* * *

## Example 2: Multi-round Conversation [​](https://api-docs.deepseek.com/guides/kv_cache\#example-2-multi-round-conversation "Direct link to Example 2: Multi-round Conversation")

**First Request**

```json
messages: [\
    {"role": "system", "content": "You are a helpful assistant"},\
    {"role": "user", "content": "What is the capital of China?"}\
]
```

**Second Request**

```json
messages: [\
    {"role": "system", "content": "You are a helpful assistant"},\
    {"role": "user", "content": "What is the capital of China?"},\
    {"role": "assistant", "content": "The capital of China is Beijing."},\
    {"role": "user", "content": "What is the capital of the United States?"}\
]
```

In this example, the second request can reuse the **initial**`system` message and `user` message from the first request, which will count as a "cache hit."

* * *

## Example 3: Using Few-shot Learning [​](https://api-docs.deepseek.com/guides/kv_cache\#example-3-using-few-shot-learning "Direct link to Example 3: Using Few-shot Learning")

In practical applications, users can enhance the model's output performance through few-shot learning. Few-shot learning involves providing a few examples in the request to allow the model to learn a specific pattern. Since few-shot generally provides the same context prefix, the cost of few-shot is significantly reduced with the support of context caching.

**First Request**

```json
messages: [\
    {"role": "system", "content": "You are a history expert. The user will provide a series of questions, and your answers should be concise and start with `Answer:`"},\
    {"role": "user", "content": "In what year did Qin Shi Huang unify the six states?"},\
    {"role": "assistant", "content": "Answer: 221 BC"},\
    {"role": "user", "content": "Who was the founder of the Han Dynasty?"},\
    {"role": "assistant", "content": "Answer: Liu Bang"},\
    {"role": "user", "content": "Who was the last emperor of the Tang Dynasty?"},\
    {"role": "assistant", "content": "Answer: Li Zhu"},\
    {"role": "user", "content": "Who was the founding emperor of the Ming Dynasty?"},\
    {"role": "assistant", "content": "Answer: Zhu Yuanzhang"},\
    {"role": "user", "content": "Who was the founding emperor of the Qing Dynasty?"}\
]
```

**Second Request**

```json
messages: [\
    {"role": "system", "content": "You are a history expert. The user will provide a series of questions, and your answers should be concise and start with `Answer:`"},\
    {"role": "user", "content": "In what year did Qin Shi Huang unify the six states?"},\
    {"role": "assistant", "content": "Answer: 221 BC"},\
    {"role": "user", "content": "Who was the founder of the Han Dynasty?"},\
    {"role": "assistant", "content": "Answer: Liu Bang"},\
    {"role": "user", "content": "Who was the last emperor of the Tang Dynasty?"},\
    {"role": "assistant", "content": "Answer: Li Zhu"},\
    {"role": "user", "content": "Who was the founding emperor of the Ming Dynasty?"},\
    {"role": "assistant", "content": "Answer: Zhu Yuanzhang"},\
    {"role": "user", "content": "When did the Shang Dynasty fall?"},\
]
```

In this example, 4-shots are used. The only difference between the two requests is the last question. The second request can reuse the content of the first 4 rounds of dialogue from the first request, which will count as a "cache hit."

* * *

## Checking Cache Hit Status [​](https://api-docs.deepseek.com/guides/kv_cache\#checking-cache-hit-status "Direct link to Checking Cache Hit Status")

In the response from the DeepSeek API, we have added two fields in the `usage` section to reflect the cache hit status of the request:

1. prompt\_cache\_hit\_tokens: The number of tokens in the input of this request that resulted in a cache hit (0.1 yuan per million tokens).

2. prompt\_cache\_miss\_tokens: The number of tokens in the input of this request that did not result in a cache hit (1 yuan per million tokens).


## Hard Disk Cache and Output Randomness [​](https://api-docs.deepseek.com/guides/kv_cache\#hard-disk-cache-and-output-randomness "Direct link to Hard Disk Cache and Output Randomness")

The hard disk cache only matches the prefix part of the user's input. The output is still generated through computation and inference, and it is influenced by parameters such as temperature, introducing randomness.

## Additional Notes [​](https://api-docs.deepseek.com/guides/kv_cache\#additional-notes "Direct link to Additional Notes")

1. The cache system uses 64 tokens as a storage unit; content less than 64 tokens will not be cached.

2. The cache system works on a "best-effort" basis and does not guarantee a 100% cache hit rate.

3. Cache construction takes seconds. Once the cache is no longer in use, it will be automatically cleared, usually within a few hours to a few days.

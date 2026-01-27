# Migrating from OpenAI to Kimi API

## About API Compatibility [Permalink for this section](https://platform.moonshot.ai/docs/guide/migrating-from-openai-to-kimi\#about-api-compatibility)

The Kimi API is compatible with OpenAI's interface specifications. You can use the [Python (opens in a new tab)](https://github.com/openai/openai-python) or [NodeJS (opens in a new tab)](https://github.com/openai/openai-node) SDKs provided by OpenAI to call and use the Kimi large language model. This means that if your application or service is developed based on OpenAI's models, you can seamlessly migrate to using the Kimi large language model by simply replacing the `base_url` and `api_key` with the configuration for the Kimi large language model. Here is an example of how to do this:

pythonnode.js

```
from openai import OpenAI

client = OpenAI(
    api_key="MOONSHOT_API_KEY", # <-- Replace MOONSHOT_API_KEY with the API Key you obtained from the Kimi Open Platform
    base_url="https://api.moonshot.ai/v1", # <-- Replace the base_url from https://api.openai.com/v1 to https://api.moonshot.ai/v1
)
```

We will do our best to ensure compatibility between the Kimi API and OpenAI. However, in some special cases, there may still be some differences and variations between the Kimi API and OpenAI (but this does not affect overall compatibility). We will detail the differences between the Kimi API and OpenAI and propose feasible migration solutions to help developers complete the migration process smoothly.

Here is a list of interfaces that are compatible with OpenAI:

- `/v1/chat/completions`
- `/v1/files`
- `/v1/files/{file_id}`
- `/v1/files/{file_id}/content`

## Temperature and N Value [Permalink for this section](https://platform.moonshot.ai/docs/guide/migrating-from-openai-to-kimi\#temperature-and-n-value)

When using OpenAI's interface, you can set both `temperature=0` and `n>1`, which means that in cases where the `temperature` value is 0, multiple different answers (i.e., choices) can be returned simultaneously.

However, in the Kimi API, when you set the `temperature` value to 0 or close to 0 (e.g., 0.001), we can only provide one answer (i.e., `len(choices)=1`). If you set `temperature` to 0 while using an `n` value greater than 1, we will return an "invalid request" error, specifically `invalid_request_error`.

**Additionally, please note that the range of values for the `temperature` parameter in the Kimi API is `[0, 1]`, while the range for the `temperature` parameter in OpenAI is `[0, 2]`.**

**Migration Recommendation**: For `kimi-k2-turbo-preview`, set `temperature=0.6` for optimal results. For older models, 0.3 remains a safe default. If your business scenario requires setting `temperature=0` to get more stable results from the Kimi large language model, please pay special attention to setting the `n` value to 1, or do not set the `n` value at all (in which case the default `n=1` will be used as the request parameter, which is valid).

## Usage Value in Stream Mode [Permalink for this section](https://platform.moonshot.ai/docs/guide/migrating-from-openai-to-kimi\#usage-value-in-stream-mode)

When using OpenAI's `chat.completions` interface, in cases of streaming output (i.e., `stream=True`), the output result does not include `usage` information by default (including `prompt_tokens`/`completion_tokens`/`total_tokens`). OpenAI provides an additional parameter `stream_options={"include_usage": True}` to include `usage` information in the **last data block** of the response.

In the Kimi API, in addition to the `stream_options={"include_usage": True}` parameter, we also place `usage` information (including `prompt_tokens`/`completion_tokens`/`total_tokens`) in the end data block of each choice.

**Migration Recommendation**: In most cases, developers do not need to take any additional compatibility measures. If your business scenario requires tracking the `usage` information for each choice individually, you can access the `choice.usage` field. Note that among different choices, only the values of `usage.completion_tokens` and `usage.total_tokens` are different, while the values of `usage.prompt_tokens` are the same for all choices.

## Deprecated function\_call [Permalink for this section](https://platform.moonshot.ai/docs/guide/migrating-from-openai-to-kimi\#deprecated-function_call)

In 2023, OpenAI introduced the `functions` parameter to enable function call functionality. After functional iteration, OpenAI later launched the tool call feature and marked the `functions` parameter as deprecated, which means that the `functions` parameter may be removed at any time in future API iterations.

The Kimi API fully supports the tool call feature. However, since `functions` has been deprecated, **the Kimi API does not support using the `functions` parameter to execute function calls**.

**Migration Recommendation**: If your application or service relies on tool calls, no additional compatibility measures are needed. If your application or service depends on the deprecated function call, we recommend migrating to tool calls. Tool calls expand the capabilities of function calls and support parallel function calls. For specific examples of tool calls, please refer to our tool call guide:

[Using Kimi API for Tool Calls (tool\_calls)](https://platform.moonshot.ai/docs/guide/use-kimi-api-to-complete-tool-calls)

Here is an example of migrating from `functions` to `tools`:

_We will present the code that needs to be modified in the form of comments, along with explanations, to help developers better understand how to perform the migration._

pythonnode.js

```
from typing import *

import json
import httpx
from openai import OpenAI

client = OpenAI(
    api_key="MOONSHOT_API_KEY",  # Replace MOONSHOT_API_KEY with the API Key you obtained from the Kimi Open Platform
    base_url="https://api.moonshot.ai/v1",
)

functions = [\
    {\
        "name": "search",  # The name of the function, please use English letters (uppercase and lowercase), numbers, plus hyphens and underscores as the function name\
        "description": """\
            Search for content on the internet using a search engine.\
\
            Call this tool when your knowledge cannot answer the user's question or when the user requests you to perform an online search. Extract the content the user wants to search for from the conversation with the user and use it as the value of the query parameter.\
            The search results include the title of the website, the website's address (URL), and a brief introduction to the website.\
        """,  # Description of the function, write the specific function here and the usage scenario so that the Kimi large language model can correctly choose which functions to use\
        "parameters": {  # Use the parameters field to define the parameters accepted by the function\
            "type": "object",  # Always use type: object to make the Kimi large language model generate a JSON Object parameter\
            "required": ["query"],  # Use the required field to tell the Kimi large language model which parameters are required\
            "properties": {  # Properties contain the specific parameter definitions, and you can define multiple parameters\
                "query": {  # Here, the key is the parameter name, and the value is the specific definition of the parameter\
                    "type": "string",  # Use type to define the parameter type\
                    "description": """\
                        The content the user wants to search for, extract it from the user's question or chat context.\
                    """  # Use description to describe the parameter so that the Kimi large language model can better generate the parameter\
                }\
            }\
        }\
    }\
]


def search_impl(query: str) -> List[Dict[str, Any]]:
    """
    search_impl uses a search engine to search for query. Most mainstream search engines (such as Bing) provide API calls, and you can choose the one you like.
    You can call the search engine API of your choice and place the website title, website link, and website introduction information in a dict and return it.

    This is just a simple example, and you may need to write some authentication, validation, and parsing code.
    """
    r = httpx.get("https://your.search.api", params={"query": query})
    return r.json()


def search(arguments: Dict[str, Any]) -> Any:
    query = arguments["query"]
    result = search_impl(query)
    return {"result": result}


function_map = {
    "search": search,
}

# ==========================================================================================================================================================
# Tools are a superset of functions, so we can construct tools using the already defined functions. We loop through each function and create the corresponding tool format;
# At the same time, we also generate the corresponding tool_map.
# ==========================================================================================================================================================

tools = []
tool_map = {}
for function in functions:
    tool = {
        "type": "function",
        "function": function,
    }
    tools.append(tool)
    tool_map[function["name"]] = function_map[function["name"]]

messages = [\
    {"role": "system",\
     "content": "You are Kimi, an artificial intelligence assistant provided by Moonshot AI. You are more proficient in Chinese and English conversations. You provide users with safe, helpful, and accurate answers. You also refuse to answer any questions involving terrorism, racism, pornography, or violence. Moonshot AI is a proper noun and should not be translated into other languages."},\
    {"role": "user", "content": "Please search the internet for Context Caching and tell me what it is."}  # The user asks Kimi to search online\
]

finish_reason = None

# ==========================================================================================================================================================
# Here, we change the finish_reason value check from function_call to tool_calls
# ==========================================================================================================================================================
# while finish_reason is None or finish_reason == "function_call":
while finish_reason is None or finish_reason == "tool_calls":
    completion = client.chat.completions.create(
        model="kimi-k2-turbo-preview",
        messages=messages,
        temperature=0.6,
        # ==========================================================================================================================================================
        # We no longer use the functions parameter, but instead use the tools parameter to enable tool calls
        # ==========================================================================================================================================================
        # function=functions,
        tools=tools,  # <-- We submit the defined tools to Kimi via the tools parameter
    )
    choice = completion.choices[0]
    finish_reason = choice.finish_reason

    # ==========================================================================================================================================================
    # Here, we replace the original function_call execution logic with the tool_calls execution logic;
    # Note that since there may be multiple tool_calls, we need to execute each one using a for loop.
    # ==========================================================================================================================================================
    # if finish_reason == "function_call":
    #   messages.append(choice.message)
    #   function_call_name = choice.message.function_call.name
    #   function_call_arguments = json.loads(choice.message.function_call.arguments)
    #   function_call = function_map[function_call_name]
    #   function_result = function_call(function_call_arguments)
    #   messages.append({
    #       "role": "function",
    #       "name": function_call_name,
    #       "content": json.dumps(function_result)
    #   })

    if finish_reason == "tool_calls":  # <-- Check if the response contains tool_calls
        messages.append(choice.message)  # <-- Add the assistant message from Kimi to the context for the next request
        for tool_call in choice.message.tool_calls:  # <-- Loop through each tool_call as there may be multiple
            tool_call_name = tool_call.function.name
            tool_call_arguments = json.loads(tool_call.function.arguments)  # <-- The arguments are serialized JSON, so we need to deserialize them
            tool_function = tool_map[tool_call_name]  # <-- Use tool_map to quickly find the function to execute
            tool_result = tool_function(tool_call_arguments)

            # Construct a message with role=tool to show the result of the tool call to the model;
            # Note that we need to provide the tool_call_id and name fields in the message so that Kimi can
            # correctly match it to the corresponding tool_call.
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "name": tool_call_name,
                "content": json.dumps(tool_result),  # <-- We agree to submit the tool call result as a string, so we serialize it here
            })

print(choice.message.content)  # <-- Finally, we return the model's response to the user
```

## About `tool_choice` [Permalink for this section](https://platform.moonshot.ai/docs/guide/migrating-from-openai-to-kimi\#about-tool_choice)

The Kimi API supports the `tool_choice` parameter, but there are some subtle differences in the values for `tool_choice` compared to OpenAI. The values for `tool_choice` that are currently compatible between Kimi API and OpenAI API are:

- [x]  "none"
- [x]  "auto"
- [x]  null

**Please note that the current version of Kimi API does not support the `tool_choice=required` parameter.**

**Migration suggestion**: If your application or service relies on the `required` value of the `tool_choice` field in the OpenAI API to ensure that the large model "definitely" selects a certain tool for invocation, we suggest using some special methods to enhance the Kimi large language model's awareness of invoking tools to partially accommodate the original business logic. For example, you can emphasize the use of a certain tool in the prompt to achieve a similar effect. We demonstrate this logic with a simplified version of the code:

pythonnode.js

```
from openai import OpenAI

client = OpenAI(
    api_key="MOONSHOT_API_KEY",  # Replace MOONSHOT_API_KEY with the API Key you obtained from the Kimi Open Platform
    base_url="https://api.moonshot.ai/v1",
)

tools = {
    # Define your tools here
}

messages = [\
    # Store your message history here\
]

completion = client.chat.completions.create(
    model="kimi-k2-turbo-preview",
    messages=messages,
    temperature=0.6,
    tools=tools,
    # tool_choice="required",  # <-- Since Kimi API does not currently support tool_choice=required, we have temporarily disabled this option
)

choice = completion.choices[0]
if choice.finish_reason != "tool_calls":
    # We assume that our business logic can confirm that tool_calls must be invoked here.
    # Without using tool_choice=required, we use the prompt to make Kimi choose a tool for invocation.
    messages.append(choice.message)
    messages.append({
        "role": "user",
        "content": "Please select a tool to handle the current issue.",  # Usually, the Kimi large language model understands the intention to invoke a tool and selects one for invocation
    })
    completion = client.chat.completions.create(
        model="kimi-k2-turbo-preview",
        messages=messages,
        temperature=0.6,
        tools=tools,
    )
    choice = completion.choices[0]
    assert choice.finish_reason == "tool_calls"  # This request should return finish_reason=tool_calls
    print(choice.message.content)
```

**Please note that this method cannot guarantee a 100% success rate in triggering tool\_calls. If your application or service has a very strong dependency on tool\_calls, please wait for the launch of the `tool_choice=required` feature in Kimi API.**

Last updated on January 26, 2026

Kimi K2.5 Multi-modal Model

# Kimi K2.5

## Overview of Kimi K2.5 Model [Permalink for this section](https://platform.moonshot.ai/docs/guide/kimi-k2-5-quickstart\#overview-of-kimi-k25-model)

Kimi K2.5 is Kimi's most intelligent model to date, achieving open-source SoTA performance in Agent, code, visual understanding, and a range of general intelligent tasks. It is also Kimi's most versatile model to date, featuring a native multimodal architecture that supports both visual and text input, thinking and non-thinking modes, and dialogue and Agent tasks. [Tech Blog (opens in a new tab)](https://www.kimi.com/blog/kimi-k2-5.html)

![kimi-k2.5](https://platform.moonshot.ai/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fk25-en.4301d842.png&w=3840&q=75)

### Breakthrough in Coding Capabilities [Permalink for this section](https://platform.moonshot.ai/docs/guide/kimi-k2-5-quickstart\#breakthrough-in-coding-capabilities)

- As a leading coding model in China, Kimi K2.5 builds upon its full-stack development and tooling ecosystem strengths, further enhancing frontend code quality and design expressiveness. This major breakthrough enables the generation of fully functional, visually appealing interactive user interfaces directly from natural language, with precise control over complex effects such as dynamic layouts and scrolling animations.

### Ultra-Long Context Support [Permalink for this section](https://platform.moonshot.ai/docs/guide/kimi-k2-5-quickstart\#ultra-long-context-support)

- `kimi-k2.5`, `kimi-k2-0905-Preview`, `kimi-k2-turbo-preview`, `kimi-k2-thinking`, and `kimi-k2-thinking-turbo` models all provide a 256K context window.

### Long-Thinking Capabilities [Permalink for this section](https://platform.moonshot.ai/docs/guide/kimi-k2-5-quickstart\#long-thinking-capabilities)

- `kimi-k2.5` still has strong reasoning capabilities, supporting multi-step tool invocation and reasoning, excelling at solving complex problems, such as complex logical reasoning, mathematical problems, and code writing.

## Example Usage [Permalink for this section](https://platform.moonshot.ai/docs/guide/kimi-k2-5-quickstart\#example-usage)

Here is a complete usage example to help you quickly get started with the Kimi K2.5 model.

### Install the OpenAI SDK [Permalink for this section](https://platform.moonshot.ai/docs/guide/kimi-k2-5-quickstart\#install-the-openai-sdk)

Kimi API is fully compatible with OpenAI's API format. You can install the OpenAI SDK as follows:

```
pip install --upgrade 'openai>=1.0'
```

### Verify the Installation [Permalink for this section](https://platform.moonshot.ai/docs/guide/kimi-k2-5-quickstart\#verify-the-installation)

```
python -c 'import openai; print("version =",openai.__version__)'

# The output may be version = 1.10.0, indicating the OpenAI SDK was installed successfully and your Python environment is using OpenAI SDK v1.10.0.
```

### Image Understanding Code Example [Permalink for this section](https://platform.moonshot.ai/docs/guide/kimi-k2-5-quickstart\#image-understanding-code-example)

```
import os
import base64

from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get("MOONSHOT_API_KEY"),
    base_url="https://api.moonshot.ai/v1",
)

# Replace kimi.png with the path to the image you want Kimi to analyze
image_path = "kimi.png"

with open(image_path, "rb") as f:
    image_data = f.read()

# Use the standard library base64.b64encode function to encode the image into base64 format
image_url = f"data:image/{os.path.splitext(image_path)[1]};base64,{base64.b64encode(image_data).decode('utf-8')}"


completion = client.chat.completions.create(
    model="kimi-k2.5",
    messages=[\
        {"role": "system", "content": "You are Kimi."},\
        {\
            "role": "user",\
            # Note: content is changed from str type to a list containing multiple content parts.\
            # Image (image_url) is one part, and text is another part.\
            "content": [\
                {\
                    "type": "image_url",  # <-- Use image_url type to upload images, with content as base64-encoded image data\
                    "image_url": {\
                        "url": image_url,\
                    },\
                },\
                {\
                    "type": "text",\
                    "text": "Please describe the content of the image.",  # <-- Use text type to provide text instructions\
                },\
            ],\
        },\
    ],
)

print(completion.choices[0].message.content)

```

If your code runs successfully with no errors, you will see output similar to the following:

```
[Image description output]
```

### Video Understanding Code Example [Permalink for this section](https://platform.moonshot.ai/docs/guide/kimi-k2-5-quickstart\#video-understanding-code-example)

```
import os
import base64

from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get("MOONSHOT_API_KEY"),
    base_url="https://api.moonshot.ai/v1",
)

# Replace kimi.mp4 with the path to the video you want Kimi to analyze
video_path = "kimi.mp4"

with open(video_path, "rb") as f:
    video_data = f.read()

# Use the standard library base64.b64encode function to encode the video into base64 format
video_url = f"data:video/{os.path.splitext(video_path)[1]};base64,{base64.b64encode(video_data).decode('utf-8')}"


completion = client.chat.completions.create(
    model="kimi-k2.5",
    messages=[\
        {"role": "system", "content": "You are Kimi."},\
        {\
            "role": "user",\
            # Note: content is changed from str type to a list containing multiple content parts.\
            # Video (video_url) is one part, and text is another part.\
            "content": [\
                {\
                    "type": "video_url",  # <-- Use video_url type to upload videos, with content as base64-encoded video data\
                    "video_url": {\
                        "url": video_url,\
                    },\
                },\
                {\
                    "type": "text",\
                    "text": "Please describe the content of the video.",  # <-- Use text type to provide text instructions\
                },\
            ],\
        },\
    ],
)

print(completion.choices[0].message.content)

```

## Best Practices [Permalink for this section](https://platform.moonshot.ai/docs/guide/kimi-k2-5-quickstart\#best-practices)

### Supported Formats [Permalink for this section](https://platform.moonshot.ai/docs/guide/kimi-k2-5-quickstart\#supported-formats)

Images are supported in formats: png, jpeg, webp, gif.

Videos are supported in formats: mp4, mpeg, mov, avi, x-flv, mpg, webm, wmv, 3gpp.

### Token Calculation and Billing [Permalink for this section](https://platform.moonshot.ai/docs/guide/kimi-k2-5-quickstart\#token-calculation-and-billing)

Image and video token usage is dynamically calculated. You can use the [token estimation API](https://platform.moonshot.ai/docs/api/estimate) to check the expected token consumption for a request containing images or video before processing.

Generally, the higher the resolution of an image, the more tokens it will consume. For videos, the number of tokens depends on the number of keyframes and their resolution—the more keyframes and the higher their resolution, the greater the token consumption.

The Vision model uses the same billing method as the `moonshot-v1` model series, with charges based on the total number of tokens processed. For more information, see:

For token pricing details, refer to [Model Pricing](https://platform.moonshot.ai/docs/pricing/chat).

### Recommended Resolution [Permalink for this section](https://platform.moonshot.ai/docs/guide/kimi-k2-5-quickstart\#recommended-resolution)

We recommend that image resolution should not exceed 4k (4096×2160), and video resolution should not exceed 2k (2048×1080). Higher resolutions will only increase processing time and will not improve the model’s understanding.

### Upload File or Base64? [Permalink for this section](https://platform.moonshot.ai/docs/guide/kimi-k2-5-quickstart\#upload-file-or-base64)

Due to the limitation on the overall size of the request body, for very large videos you **must** use the file upload method to utilize vision capabilities.For images or videos that will be referenced multiple times, it is recommended to use the file upload method. Regarding file upload limitations, please refer to the [File Upload documentation](https://platform.moonshot.ai/docs/api/files).

Image quantity limit: The Vision model has no limit on the number of images, but ensure that the request body size does not exceed 100M

URL-formatted images: Not supported, currently only supports base64-encoded image content

## Parameters Differences in Request Body [Permalink for this section](https://platform.moonshot.ai/docs/guide/kimi-k2-5-quickstart\#parameters-differences-in-request-body)

Parameters are listed in [chat](https://platform.moonshot.ai/docs/api/chat.en-US#request-body). However, behaviour of some parameters may be different in k2.5 models.

**We recommend using the default values instead of manually configuring these parameters.**

Differences are listed below.

| Field | Required | Description | Type | Values |
| --- | --- | --- | --- | --- |
| max\_tokens | optional | The maximum number of tokens to generate for the chat completion. | int | Default to be 32k aka 32768 |
| thinking | optional | **New!** This parameter controls if the thinking is enabled for this request | object | Default to be `{"type": "enabled"}`. Value can only be one of `{"type": "enabled"}` or `{"type": "disabled"}` |
| temperature | optional | The sampling temperature to use | float | k2.5 model will use a fixed value 1.0, non-thinking mode will use a fixed value 0.6. Any other value will result in an error |
| top\_p | optional | A sampling method | float | k2.5 model will use a fixed value 0.95. Any other value will result in an error |
| n | optional | The number of results to generate for each input message | int | k2.5 model will use a fixed value 1. Any other value will result in an error |
| presence\_penalty | optional | Penalizing new tokens based on whether they appear in the text | float | k2.5 model will use a fixed value 0.0. Any other value will result in an error |
| frequency\_penalty | optional | Penalizing new tokens based on their existing frequency in the text | float | k2.5 model will use a fixed value 0.0. Any other value will result in an error |

## Model Pricing [Permalink for this section](https://platform.moonshot.ai/docs/guide/kimi-k2-5-quickstart\#model-pricing)

| Model | Unit | Input Price<br>（Cache Hit） | Input Price<br>（Cache Miss） | Output Price | Context Window |
| --- | --- | --- | --- | --- | --- |
| kimi-k2.5 | 1M tokens | $0.10 | $0.60 | $3.00 | 262,144 tokens |

## Learn More [Permalink for this section](https://platform.moonshot.ai/docs/guide/kimi-k2-5-quickstart\#learn-more)

- For the benchmark testing with Kimi K2.5, please refer to this [benchmark best practice](https://platform.moonshot.ai/docs/guide/benchmark-best-practice)
- For the most detailed API usage example of Kimi K2.5, see: [How to Use Kimi Vision Model](https://platform.moonshot.ai/docs/guide/use-kimi-vision-model)
- See [How to Use Kimi K2 in Claude Code, Roo Code, and Cline](https://platform.moonshot.ai/docs/guide/agent-support)
- Learn how to configure and use the [Thinking Model](https://platform.moonshot.ai/docs/guide/use-kimi-k2-thinking-model)
- Web search is a powerful official tool provided by the Kimi API. See how to use [Web Search](https://platform.moonshot.ai/docs/guide/use-web-search) and other [official tools](https://platform.moonshot.ai/docs/guide/use-formula-tool-in-chatapi).
- For all model pricing see [here](https://platform.moonshot.ai/docs/pricing/chat), [Billing & Rate Limit details](https://platform.moonshot.ai/docs/pricing/limits), and [Web Search Pricing](https://platform.moonshot.ai/docs/pricing/tools)

Last updated on January 27, 2026

# Use the Kimi API for Multi-turn Chat

The Kimi API is different from the Kimi intelligent assistant. **The API itself doesn't have a memory function; it's stateless**. This means that when you make multiple requests to the API, the Kimi large language model doesn't remember what you asked in the previous request. For example, if you tell the Kimi large language model that you are 27 years old in one request, it won't remember that you are 27 years old in the next request.

So, we need to manually keep track of the context for each request. In other words, we have to manually add the content of the previous request to the next one so that the Kimi large language model can see what we have talked about before. We will modify the example used in the previous chapter to show how to maintain a list of messages to give the Kimi large language model a memory and enable multi-turn conversation functionality.

_Note: We have added the key points for implementing multi-turn conversations as comments in the code._

pythonnode.js

```
from openai import OpenAI

client = OpenAI(
    api_key = "MOONSHOT_API_KEY", # Replace MOONSHOT_API_KEY with the API Key you obtained from the Kimi Open Platform
    base_url = "https://api.moonshot.ai/v1",
)

# We define a global variable messages to keep track of the historical conversation messages between us and the Kimi large language model
# The messages include both the questions we ask the Kimi large language model (role=user) and the replies it gives us (role=assistant)
# Of course, it also includes the initial System Prompt (role=system)
# The messages in the list are arranged in chronological order
messages = [\
	{"role": "system", "content": "You are Kimi, an artificial intelligence assistant provided by Moonshot AI. You are better at conversing in Chinese and English. You provide users with safe, helpful, and accurate answers. At the same time, you refuse to answer any questions involving terrorism, racism, pornography, or violence. Moonshot AI is a proper noun and should not be translated into other languages."},\
]

def chat(input: str) -> str:
	"""
	The chat function supports multi-turn conversations. Each time the chat function is called to converse with the Kimi large language model, the model will 'see' the historical conversation messages that have already been generated. In other words, the Kimi large language model has a memory.
	"""

  global messages

	# We construct the user's latest question as a message (role=user) and add it to the end of the messages list
	messages.append({
		"role": "user",
		"content": input,
	})

	# We converse with the Kimi large language model, carrying the messages along
	completion = client.chat.completions.create(
        model="kimi-k2-turbo-preview",
        messages=messages,
        temperature=0.6,
    )

	# Through the API, we receive the reply message (role=assistant) from the Kimi large language model
    assistant_message = completion.choices[0].message

    # To give the Kimi large language model a complete memory, we must also add the message it returns to us to the messages list
    messages.append(assistant_message)

    return assistant_message.content

print(chat("Hello, I am 27 years old this year."))
print(chat("Do you know how old I am this year?")) # Here, based on the previous context, the Kimi large language model will know that you are 27 years old
```

Let's review the key points in the code above:

- The Kimi API itself doesn't have a context memory function. We need to manually inform the Kimi large language model of what we have talked about before through the messages parameter in the API;
- In the messages, we need to store both the question messages we ask the Kimi large language model (role=user) and the reply messages it gives us (role=assistant);

It's important to note that in the code above, as the number of `chat` calls increases, the length of the `messages` list also keeps growing. This means that the number of Tokens consumed by each request is also increasing. Eventually, at some point, the Tokens occupied by the messages in the `messages` list will exceed the context window size supported by the Kimi large language model. We recommend that you use some strategy to keep the number of messages in the `messages` list within a manageable range. For example, you could only keep the latest 20 messages as the context for each request.

We provide an example below to help you understand how to control the context length. Pay attention to how the `make_messages` function works:

pythonnode.js

```
from openai import OpenAI

client = OpenAI(
    api_key = "MOONSHOT_API_KEY", # Replace MOONSHOT_API_KEY with the API Key you obtained from the Kimi Open Platform
    base_url = "https://api.moonshot.ai/v1",
)

# We place the System Messages in a separate list because every request should carry the System Messages.
system_messages = [\
	{"role": "system", "content": "You are Kimi, an AI assistant provided by Moonshot AI. You are more proficient in conversing in Chinese and English. You provide users with safe, helpful, and accurate responses. You also reject any questions involving terrorism, racism, pornography, or violence. Moonshot AI is a proper noun and should not be translated into other languages."},\
]

# We define a global variable messages to record the historical conversation messages between us and the Kimi large language model.
# The messages include both the questions we pose to the Kimi large language model (role=user) and the replies from the Kimi large language model (role=assistant).
# The messages are arranged in chronological order.
messages = []


def make_messages(input: str, n: int = 20) -> list[dict]:
	"""
	The make_messages function controls the number of messages in each request to keep it within a reasonable range, such as the default value of 20. When building the message list, we first add the System Prompt because it is essential no matter how the messages are truncated. Then, we obtain the latest n messages from the historical records as the messages for the request. In most scenarios, this ensures that the number of Tokens occupied by the request messages does not exceed the model's context window.
	"""
	# First, we construct the user's latest question into a message (role=user) and add it to the end of the messages list.
	messages.append({
		"role": "user",
		"content": input,
	})

	# new_messages is the list of messages we will use for the next request. Let's build it now.
	new_messages = []

	# Every request must carry the System Messages, so we need to add the system_messages to the message list first.
	# Note that even if the messages are truncated, the System Messages should still be in the messages list.
	new_messages.extend(system_messages)

	# Here, when the historical messages exceed n, we only keep the latest n messages.
	if len(messages) > n:
		messages = messages[-n:]

	new_messages.extend(messages)
	return new_messages


def chat(input: str) -> str:
	"""
	The chat function supports multi-turn conversations. Each time the chat function is called to converse with the Kimi large language model, the model can "see" the historical conversation messages that have already been generated. In other words, the Kimi large language model has memory.
	"""

	# We converse with the Kimi large language model carrying the messages.
	completion = client.chat.completions.create(
        model="kimi-k2-turbo-preview",
        messages=make_messages(input),
        temperature=0.6,
    )

	# Through the API, we obtain the reply message from the Kimi large language model (role=assistant).
    assistant_message = completion.choices[0].message

    # To ensure the Kimi large language model has a complete memory, we must add the message returned by the model to the messages list.
    messages.append(assistant_message)

    return assistant_message.content

print(chat("Hello, I am 27 years old this year."))
print(chat("Do you know how old I am this year?")) # Here, based on the previous context, the Kimi large language model will know that you are 27 years old this year.
```

Please note that the above code examples only consider the simplest invocation scenarios. In actual business code logic, you may need to consider more scenarios and boundaries, such as:

- In concurrent scenarios, additional read-write locks may be needed;
- For multi-user scenarios, a separate messages list should be maintained for each user;
- You may need to persist the messages list;
- You may still need a more precise way to determine how many messages to retain in the messages list;
- You may want to summarize the discarded messages and generate a new message to add to the messages list;
- ……

# Use the Streaming Feature of the Kimi API

When the Kimi large language model receives a question from a user, it first performs inference and then **generates the response one Token at a time**. In the examples from our first two chapters, we chose to wait for the Kimi large language model to generate all Tokens before printing its response. This usually takes several seconds. If your question is complex enough and the response from the Kimi large language model is long enough, the time to wait for the complete response can be stretched to 10 or even 20 seconds, which greatly reduces the user experience. To improve this situation and provide timely feedback to users, we offer the ability to stream output, known as Streaming. We will explain the principles of Streaming and illustrate it with actual code:

- How to use streaming output;
- Common issues when using streaming output;
- How to handle streaming output without using the Python SDK;

## How to Use Streaming Output [Permalink for this section](https://platform.moonshot.ai/docs/guide/utilize-the-streaming-output-feature-of-kimi-api\#how-to-use-streaming-output)

Streaming, in a nutshell, means that whenever the Kimi large language model generates a certain number of Tokens (usually 1 Token), it immediately sends these Tokens to the client, instead of waiting for all Tokens to be generated before sending them to the client. When you chat with [Kimi AI Assistant (opens in a new tab)](https://kimi.ai/), the assistant's response appears character by character, which is one manifestation of streaming output. **Streaming allows users to see the first Token output by the Kimi large language model immediately, reducing wait time**.

You can use streaming output in this way (stream=True) and get the streaming response:

pythonnode.js

```
from openai import OpenAI

client = OpenAI(
    api_key = "MOONSHOT_API_KEY", # Replace MOONSHOT_API_KEY with the API Key you obtained from the Kimi Open Platform
    base_url = "https://api.moonshot.ai/v1",
)

stream = client.chat.completions.create(
    model = "kimi-k2-turbo-preview",
    messages = [\
        {"role": "system", "content": "You are Kimi, an artificial intelligence assistant provided by Moonshot AI, who is better at conversing in Chinese and English. You provide users with safe, helpful, and accurate answers. At the same time, you refuse to answer any questions related to terrorism, racism, pornography, and violence. Moonshot AI is a proper noun and should not be translated into other languages."},\
        {"role": "user", "content": "Hello, my name is Li Lei, what is 1+1?"}\
    ],
    temperature = 0.6,
    stream=True, # <-- Note here, we enable streaming output mode by setting stream=True
)

# When streaming output mode is enabled (stream=True), the content returned by the SDK also changes. We no longer directly access the choice in the return value
# Instead, we access each individual chunk in the return value through a for loop

for chunk in stream:
	# Here, the structure of each chunk is similar to the previous completion, but the message field is replaced with the delta field
	delta = chunk.choices[0].delta # <-- The message field is replaced with the delta field

	if delta.content:
		# When printing the content, since it is streaming output, to ensure the coherence of the sentence, we do not add
		# line breaks manually, so we set end="" to cancel the line break of print.
		print(delta.content, end="")
```

## Common Issues When Using Streaming Output [Permalink for this section](https://platform.moonshot.ai/docs/guide/utilize-the-streaming-output-feature-of-kimi-api\#common-issues-when-using-streaming-output)

Now that you have successfully run the above code and understood the basic principles of streaming output, let's discuss some details and common issues of streaming output so that you can better implement your business logic.

### Interface Details [Permalink for this section](https://platform.moonshot.ai/docs/guide/utilize-the-streaming-output-feature-of-kimi-api\#interface-details)

When streaming output mode is enabled (stream=True), the Kimi large language model no longer returns a response in JSON format (`Content-Type: application/json`), but uses `Content-Type: text/event-stream` (abbreviated as SSE). This response format allows the server to continuously send data to the client. In the context of using the Kimi large language model, it can be understood as the server continuously sending Tokens to the client.

When you look at the HTTP response body of [SSE (opens in a new tab)](https://kimi.moonshot.cn/share/cr7boh3dqn37a5q9tds0), it looks like this:

```
data: {"id":"cmpl-1305b94c570f447fbde3180560736287","object":"chat.completion.chunk","created":1698999575,"model":"kimi-k2-turbo-preview","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}

data: {"id":"cmpl-1305b94c570f447fbde3180560736287","object":"chat.completion.chunk","created":1698999575,"model":"kimi-k2-turbo-preview","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

...

data: {"id":"cmpl-1305b94c570f447fbde3180560736287","object":"chat.completion.chunk","created":1698999575,"model":"kimi-k2-turbo-preview","choices":[{"index":0,"delta":{"content":"."},"finish_reason":null}]}

data: {"id":"cmpl-1305b94c570f447fbde3180560736287","object":"chat.completion.chunk","created":1698999575,"model":"kimi-k2-turbo-preview","choices":[{"index":0,"delta":{},"finish_reason":"stop","usage":{"prompt_tokens":19,"completion_tokens":13,"total_tokens":32}}]}

data: [DONE]
```

In the response body of [SSE (opens in a new tab)](https://kimi.moonshot.cn/share/cr7boh3dqn37a5q9tds0), we agree that each data chunk starts with `data:`, followed by a valid JSON object, and ends with two newline characters `\n\n`. Finally, when all data chunks have been transmitted, `data: [DONE]` is used to indicate that the transmission is complete, at which point the network connection can be disconnected.

### Token Calculation [Permalink for this section](https://platform.moonshot.ai/docs/guide/utilize-the-streaming-output-feature-of-kimi-api\#token-calculation)

When using the streaming output mode, there are two ways to calculate tokens. The most straightforward and accurate method is to wait until all data chunks have been transmitted and then check the `prompt_tokens`, `completion_tokens`, and `total_tokens` in the `usage` field of the last data chunk.

```
...

data: {"id":"cmpl-1305b94c570f447fbde3180560736287","object":"chat.completion.chunk","created":1698999575,"model":"kimi-k2-turbo-preview","choices":[{"index":0,"delta":{},"finish_reason":"stop","usage":{"prompt_tokens":19,"completion_tokens":13,"total_tokens":32}}]}
                                               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                               Check the number of tokens generated by the current request through the usage field in the last data chunk
data: [DONE]
```

However, in practice, streaming output can be interrupted by uncontrollable factors such as network disconnections or client-side errors. In such cases, the last data chunk may not have been fully transmitted, making it impossible to know the total number of tokens consumed by the request. To avoid this issue, we recommend saving the content of each data chunk as it is received and then using the token calculation interface to compute the total consumption after the request ends, regardless of whether it was successful or not. Here is an example code snippet:

pythonnode.js

```
import os
import httpx
from openai import OpenAI

client = OpenAI(
    api_key = "MOONSHOT_API_KEY", # Replace MOONSHOT_API_KEY with the API Key you obtained from the Kimi Open Platform
    base_url = "https://api.moonshot.ai/v1",
)

stream = client.chat.completions.create(
    model = "kimi-k2-turbo-preview",
    messages = [\
        {"role": "system", "content": "You are Kimi, an AI assistant provided by Moonshot AI, who excels in Chinese and English conversations. You provide users with safe, helpful, and accurate answers while rejecting any questions related to terrorism, racism, or explicit content. Moonshot AI is a proper noun and should not be translated."},\
        {"role": "user", "content": "Hello, my name is Li Lei. What is 1+1?"}\
    ],
    temperature = 0.6,
    stream=True, # <-- Note here, we enable streaming output mode by setting stream=True
)


def estimate_token_count(input: str) -> int:
    """
    Implement your token calculation logic here, or directly call our token calculation interface to compute tokens.

    https://api.moonshot.ai/v1/tokenizers/estimate-token-count
    """
    header = {
        "Authorization": f"Bearer {os.environ['MOONSHOT_API_KEY']}",
    }
    data = {
        "model": "kimi-k2-turbo-preview",
        "messages": [\
            {"role": "user", "content": input},\
        ]
    }
    r = httpx.post("https://api.moonshot.ai/v1/tokenizers/estimate-token-count", headers=header, json=data)
    r.raise_for_status()
    return r.json()["data"]["total_tokens"]


completion = []
for chunk in stream:
	delta = chunk.choices[0].delta
	if delta.content:
		completion.append(delta.content)


print("completion_tokens:", estimate_token_count("".join(completion)))
```

### How to Terminate Output [Permalink for this section](https://platform.moonshot.ai/docs/guide/utilize-the-streaming-output-feature-of-kimi-api\#how-to-terminate-output)

If you want to stop the streaming output, you can simply close the HTTP connection or discard any subsequent data chunks. For example:

```
for chunk in stream:
	if condition:
		break
```

## How to Handle Streaming Output Without Using an SDK [Permalink for this section](https://platform.moonshot.ai/docs/guide/utilize-the-streaming-output-feature-of-kimi-api\#how-to-handle-streaming-output-without-using-an-sdk)

If you prefer not to use the Python SDK to handle streaming output and instead want to directly interface with HTTP APIs to use the Kimi large language model (for example, in cases where you are using a language without an SDK, or you have unique business logic that the SDK cannot meet), we provide some examples to help you understand how to properly handle the [SSE (opens in a new tab)](https://kimi.moonshot.cn/share/cr7boh3dqn37a5q9tds0) response body in HTTP (we still use Python code as an example here, with detailed explanations provided in comments).

pythonnode.js

```
import httpx # We use the httpx library to make our HTTP requests


data = {
	"model": "kimi-k2-turbo-preview",
	"messages": [\
		# Specific messages\
	],
	"temperature": 0.6,
	"stream": True,
}


# Use httpx to send a chat request to the Kimi large language model and get the response r
r = httpx.post("https://api.moonshot.ai/v1/chat/completions", json=data)
if r.status_code != 200:
	raise Exception(r.text)


data: str

# Here, we use the iter_lines method to read the response body line by line
for line in r.iter_lines():
	# Remove leading and trailing spaces from each line to better handle data chunks
	line = line.strip()

	# Next, we need to handle three different cases:
	#   1. If the current line is empty, it indicates that the previous data chunk has been received (as mentioned earlier, the data chunk transmission ends with two newline characters), we can deserialize the data chunk and print the corresponding content;
	#   2. If the current line is not empty and starts with data:, it indicates the start of a data chunk transmission, we remove the data: prefix and first check if it is the end symbol [DONE], if not, save the data content to the data variable;
	#   3. If the current line is not empty but does not start with data:, it indicates that the current line still belongs to the previous data chunk being transmitted, we append the content of the current line to the end of the data variable;

	if len(line) == 0:
		chunk = json.loads(data)

		# The processing logic here can be replaced with your business logic, printing is just to demonstrate the process
		choice = chunk["choices"][0]
		usage = choice.get("usage")
		if usage:
			print("total_tokens:", usage["total_tokens"])
		delta = choice["delta"]
		role = delta.get("role")
		if role:
			print("role:", role)
		content = delta.get("content")
		if content:
			print(content, end="")

		data = "" # Reset data
	elif line.startswith("data: "):
		data = line.lstrip("data: ")

		# When the data chunk content is [DONE], it indicates that all data chunks have been sent, and the network connection can be disconnected
		if data == "[DONE]":
			break
	else:
		data = data + "\n" + line # We still add a newline character when appending content, as this data chunk may intentionally format the data in separate lines
```

The above is the process of handling streaming output using Python as an example. If you are using other languages, you can also properly handle the content of streaming output. The basic steps are as follows:

1. Initiate an HTTP request and set the `stream` parameter in the request body to `true`;
2. Receive the response from the server. Note that if the `Content-Type` in the response `Headers` is `text/event-stream`, it indicates that the response content is a streaming output;
3. Read the response content line by line and parse the data chunks (the data chunks are presented in JSON format). Pay attention to determining the start and end positions of the data chunks through the `data:` prefix and newline character `\n`;
4. Determine whether the transmission is complete by checking if the current data chunk content is `[DONE]`;

_Note: Always use `data: [DONE]` to determine if the data has been fully transmitted, rather than using `finish_reason` or other methods. If you do not receive the `data: [DONE]` message chunk, even if you have obtained the information `finish_reason=stop`, you should not consider the data chunk transmission as complete. In other words, until you receive the `data: [DONE]` data chunk, the message should be considered **incomplete**._

During the streaming output process, only the `content` field is streamed, meaning each data chunk contains a portion of the `content` tokens. For fields that do not need to be streamed, such as `role` and `usage`, we usually present them all at once in the first or last data chunk, rather than including the `role` and `usage` fields in every data chunk (specifically, the `role` field will only appear in the first data chunk and will not be included in subsequent data chunks; the `usage` field will only appear in the last data chunk and will not be included in the preceding data chunks).

### Handling `n>1` [Permalink for this section](https://platform.moonshot.ai/docs/guide/utilize-the-streaming-output-feature-of-kimi-api\#handling-n1)

Sometimes, we want to get multiple results to choose from. To do this, you should set the `n` parameter in the request to a value greater than 1. When it comes to stream output, we also support the use of `n>1`. In such cases, we need to add some extra code to determine the `index` value of the current data block, to figure out which response the data block belongs to. Let's illustrate this with example code:

pythonnode.js

```
import httpx # We use the httpx library to make our HTTP requests


data = {
	"model": "kimi-k2-turbo-preview",
	"messages": [\
		# Specific messages go here\
	],
	"temperature": 0.6,
	"stream": True,
	"n": 2, # <-- Note here, we're asking the Kimi large language model to output 2 responses
}


# Use httpx to send a chat request to the Kimi large language model and get the response r
r = httpx.post("https://api.moonshot.ai/v1/chat/completions", json=data)
if r.status_code != 200:
	raise Exception(r.text)


data: str

# Here, we pre-build a List to store different response messages. Since we set n=2, we initialize the List with 2 elements
messages = [{}, {}]

# We use the iter_lines method here to read the response body line by line
for line in r.iter_lines():
	# Remove leading and trailing spaces from each line to better handle data blocks
	line = line.strip()

	# Next, we need to handle three different scenarios:
	#   1. If the current line is empty, it indicates that the previous data block has been fully received (as mentioned earlier, data block transmission ends with two newline characters). We can deserialize this data block and print out the corresponding content;
	#   2. If the current line is not empty and starts with data:, it means the start of a data block transmission. After removing the data: prefix, we first check if it's the end marker [DONE]. If not, we save the data content to the data variable;
	#   3. If the current line is not empty but doesn't start with data:, it means this line still belongs to the previous data block being transmitted. We append the content of this line to the end of the data variable;

	if len(line) == 0:
		chunk = json.loads(data)

		# Loop through all choices in each data block to get the message object corresponding to the index
		for choice in chunk["choices"]:
			index = choice["index"]
			message = messages[index]
			usage = choice.get("usage")
			if usage:
				message["usage"] = usage
			delta = choice["delta"]
			role = delta.get("role")
			if role:
				message["role"] = role
			content = delta.get("content")
			if content:
				message["content"] = message.get("content", "") + content

			data = "" # Reset data
	elif line.startswith("data: "):
		data = line.lstrip("data: ")

		# When the data block content is [DONE], it means all data blocks have been sent and we can disconnect the network
		if data == "[DONE]":
			break
	else:
		data = data + "\n" + line # When we're still appending content, we add a newline character because this might be the data block's intentional way of displaying data on separate lines


# After assembling all messages, we print their contents separately
for index, message in enumerate(messages):
	print("index:", index)
	print("message:", json.dumps(message, ensure_ascii=False))
```

When `n>1`, the key to handling stream output is to first determine which response message the current data block belongs to based on its `index` value, and then proceed with further logical processing.

Last updated on January 26, 2026

# Using thinking models

> Both the `kimi-k2-thinking` and `kimi-k2.5` models have powerful thinking capabilities, supporting deep reasoning and multi-step tool use to solve complex problems.
>
> - **`kimi-k2-thinking`**: A dedicated thinking model with thinking enabled by default
> - **\[Recommended\] `kimi-k2.5`**: Enable thinking capability via the `thinking` parameter, with a default value of `{"type": "enabled"}`
>
> Both models require the same configuration approach when using thinking capabilities.

If you are doing benchmark testing with kimi api, please refer to this [benchmark best practice](https://platform.moonshot.ai/docs/guide/benchmark-best-practice).

## Basic use case [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-k2-thinking-model\#basic-use-case)

### Using the kimi-k2-thinking model [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-k2-thinking-model\#using-the-kimi-k2-thinking-model)

You can simply use it by switching the `model` parameter:

curlpython

```
$ curl https://api.moonshot.ai/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $MOONSHOT_API_KEY" \
    -d '{
        "model": "kimi-k2-thinking",
        "messages": [\
            {"role": "user", "content": "hello"}\
        ],
        "temperature": 1.0
   }'

```

### Using the kimi-k2.5 model with thinking enabled [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-k2-thinking-model\#using-the-kimi-k25-model-with-thinking-enabled)

For the `kimi-k2.5` model, you need to enable thinking capability via the `thinking` parameter:

curlpython

```
$ curl https://api.moonshot.ai/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $MOONSHOT_API_KEY" \
    -d '{
        "model": "kimi-k2.5",
        "messages": [\
            {"role": "user", "content": "hello"}\
        ],
        "thinking": {"type": "enabled"},
        "temperature": 1.0
   }'

```

## Accessing the reasoning content [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-k2-thinking-model\#accessing-the-reasoning-content)

In the API response for `kimi-k2-thinking` or `kimi-k2.5` (with thinking enabled) models, we use the `reasoning_content` field as the carrier for the model's reasoning. About the `reasoning_content` field:

- In the OpenAI SDK, `ChoiceDelta` and `ChatCompletionMessage` types do not provide a `reasoning_content` field directly, so you cannot access it via `.reasoning_content`. You must use `hasattr(obj, "reasoning_content")` to check if the field exists, and if so, use `getattr(obj, "reasoning_content")` to retrieve its value.
- If you use other frameworks or directly interface with the HTTP API, you can directly obtain the `reasoning_content` field at the same level as the `content` field.
- In streaming output (`stream=True`), the `reasoning_content` field will always appear before the `content` field. In your business logic, you can detect if the `content` field has been output to determine if the reasoning (inference process) is finished.
- Tokens in `reasoning_content` are also controlled by the `max_tokens` parameter: the sum of tokens in `reasoning_content` and `content` must be less than or equal to `max_tokens`.

## Multi-Step Tool Call [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-k2-thinking-model\#multi-step-tool-call)

Both `kimi-k2-thinking` and `kimi-k2.5` (with thinking enabled) are designed to perform deep reasoning across multiple tool calls, enabling them to tackle highly complex tasks.

### Usage Notes [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-k2-thinking-model\#usage-notes)

To get reliable results, **whether using `kimi-k2-thinking` or `kimi-k2.5` (with thinking enabled via the `thinking` parameter), always follow these configuration rules:**

- For the `kimi-k2.5` model, you need to set `thinking={"type": "enabled"}` to enable thinking capability (this is the default value, but you can also specify it explicitly).
- Include the entire reasoning content from the context (the reasoning\_content field) in your input. The model will decide which parts are necessary and forward them for further reasoning.
- Set max\_tokens ≥ 16,000 to ensure the full reasoning\_content and final content can be returned without truncation.
- **Set temperature = 1.0 to get the best performance.**
- Enable streaming (stream = true). Because thinking models return both reasoning\_content and regular content, the response is larger than usual. Streaming delivers a better user experience and helps avoid network-timeout issues.

### Complete example [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-k2-thinking-model\#complete-example)

We walk through a complete example that shows how to properly use thinking models together with official tools for multi-step tool call and extended reasoning.

The example below demonstrates a "Daily News Report Generation" scenario. The model will sequentially call official tools like `date` (to get the date) and `web_search` (to search today's news), and will present deep reasoning throughout this process.

**Note**: This example uses the `kimi-k2-thinking` model. If you use the `kimi-k2.5` model, you need to add the `thinking={"type": "enabled"}` parameter when calling the model.

```
import os
import json
import httpx
import openai


class FormulaChatClient:
    def __init__(self, base_url: str, api_key: str):
        """Initialize Formula client"""
        self.base_url = base_url
        self.api_key = api_key
        self.openai = openai.Client(
            base_url=base_url,
            api_key=api_key,
        )
        self.httpx = httpx.Client(
            base_url=base_url,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=30.0,
        )
        # Using kimi-k2-thinking model
        # If using kimi-k2.5 model, change to "kimi-k2.5" and add thinking={"type": "enabled"} parameter when calling
        self.model = "kimi-k2-thinking"

    def get_tools(self, formula_uri: str):
        """Get tool definitions from Formula API"""
        response = self.httpx.get(f"/formulas/{formula_uri}/tools")
        response.raise_for_status()

        try:
            return response.json().get("tools", [])
        except json.JSONDecodeError as e:
            print(f"Error: Unable to parse JSON (status code: {response.status_code})")
            print(f"Response content: {response.text[:500]}")
            raise

    def call_tool(self, formula_uri: str, function: str, args: dict):
        """Call an official tool"""
        response = self.httpx.post(
            f"/formulas/{formula_uri}/fibers",
            json={"name": function, "arguments": json.dumps(args)},
        )
        response.raise_for_status()
        fiber = response.json()

        if fiber.get("status", "") == "succeeded":
            return fiber["context"].get("output") or fiber["context"].get("encrypted_output")

        if "error" in fiber:
            return f"Error: {fiber['error']}"
        if "error" in fiber.get("context", {}):
            return f"Error: {fiber['context']['error']}"
        return "Error: Unknown error"

    def close(self):
        """Close the client connection"""
        self.httpx.close()


# Initialize client
base_url = os.getenv("MOONSHOT_BASE_URL", "https://api.moonshot.ai/v1")
api_key = os.getenv("MOONSHOT_API_KEY")

if not api_key:
    raise ValueError("MOONSHOT_API_KEY environment variable not set. Please set your API key.")

print(f"Base URL: {base_url}")
print(f"API Key: {api_key[:10]}...{api_key[-10:] if len(api_key) > 20 else api_key}\n")

client = FormulaChatClient(base_url, api_key)

# Define the official tool Formula URIs to use
formula_uris = [\
    "moonshot/date:latest",\
    "moonshot/web-search:latest"\
]

# Load all tool definitions and build mapping
print("Loading official tools...")
all_tools = []
tool_to_uri = {}  # function.name -> formula_uri

for uri in formula_uris:
    try:
        tools = client.get_tools(uri)
        for tool in tools:
            func = tool.get("function")
            if func:
                func_name = func.get("name")
                if func_name:
                    tool_to_uri[func_name] = uri
                    all_tools.append(tool)
                    print(f"  Loaded tool: {func_name} from {uri}")
    except Exception as e:
        print(f"  Warning: Failed to load tool {uri}: {e}")
        continue

print(f"Loaded {len(all_tools)} tools in total\n")

if not all_tools:
    raise ValueError("No tools loaded. Please check API key and network connection.")

# Initialize message list
messages = [\
    {\
        "role": "system",\
        "content": "You are Kimi, a professional news analyst. You excel at collecting, analyzing, and organizing information to generate high-quality news reports.",\
    },\
]

# User request to generate today's news report
user_request = "Please help me generate a daily news report including important technology, economy, and society news."
messages.append({
    "role": "user",
    "content": user_request
})

print(f"User request: {user_request}\n")

# Begin multi-step conversation loop
max_iterations = 10  # Prevent infinite loops
for iteration in range(max_iterations):
    try:
        completion = client.openai.chat.completions.create(
            model=client.model,
            messages=messages,
            max_tokens=1024 * 32,
            tools=all_tools,
            temperature=1.0,
            # If using kimi-k2.5 model, add the following parameter:
            # thinking={"type": "enabled"},
        )
    except openai.AuthenticationError as e:
        print(f"Authentication error: {e}")
        print("Please check if the API key is correct and has the required permissions")
        raise
    except Exception as e:
        print(f"Error while calling the model: {e}")
        raise

    # Get response
    message = completion.choices[0].message

    # Print reasoning process
    if hasattr(message, "reasoning_content"):
        print(f"=============Reasoning round {iteration + 1} starts=============")
        reasoning = getattr(message, "reasoning_content")
        if reasoning:
            print(reasoning[:500] + "..." if len(reasoning) > 500 else reasoning)
        print(f"=============Reasoning round {iteration + 1} ends=============\n")

    # Add assistant message to context (preserve reasoning_content)
    messages.append(message)

    # If the model did not call any tools, conversation is done
    if not message.tool_calls:
        print("=============Final Answer=============")
        print(message.content)
        break

    # Handle tool calls
    print(f"The model decided to call {len(message.tool_calls)} tool(s):\n")

    for tool_call in message.tool_calls:
        func_name = tool_call.function.name
        args = json.loads(tool_call.function.arguments)

        print(f"Calling tool: {func_name}")
        print(f"Arguments: {json.dumps(args, ensure_ascii=False, indent=2)}")

        # Get corresponding formula_uri
        formula_uri = tool_to_uri.get(func_name)
        if not formula_uri:
            print(f"Error: Could not find Formula URI for tool {func_name}")
            continue

        # Call the tool
        result = client.call_tool(formula_uri, func_name, args)

        # Print result (truncate if too long)
        if len(str(result)) > 200:
            print(f"Tool result: {str(result)[:200]}...\n")
        else:
            print(f"Tool result: {result}\n")

        # Add tool result to message list
        tool_message = {
            "role": "tool",
            "tool_call_id": tool_call.id,
            "name": func_name,
            "content": result
        }
        messages.append(tool_message)

print("\nConversation completed!")

# Cleanup
client.close()
```

This process demonstrates how the `kimi-k2-thinking` or `kimi-k2.5` (with thinking enabled) model uses deep reasoning to plan and execute complex multi-step tasks, with detailed reasoning steps (`reasoning_content`) preserved in the context to ensure accurate tool use at every stage.

## Frequently Asked Questions [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-k2-thinking-model\#frequently-asked-questions)

### Q1: Why should I keep `reasoning_content`? [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-k2-thinking-model\#q1-why-should-i-keep-reasoning_content)

A: Keeping the `reasoning_content` ensures the model maintains reasoning continuity in multi-step reasoning scenarios, especially when calling tools. The server will automatically handle these fields; users do not need to manage them manually.

### Q2: Does `reasoning_content` consume extra tokens? [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-k2-thinking-model\#q2-does-reasoning_content-consume-extra-tokens)

A: Yes, `reasoning_content` counts towards your input/output token quota. For detailed pricing, please refer to MoonshotAI's pricing documentation.

Last updated on January 26, 2026

# Use the Kimi Vision Model

The Kimi Vision Model (including `moonshot-v1-8k-vision-preview` / `moonshot-v1-32k-vision-preview` / `moonshot-v1-128k-vision-preview` / `kimi-k2.5` and so on) can understand visual content, including text in the image, colors, and the shapes of objects. The latest kimi-k2.5 model can also understand video content.

## Using base64 to Upload Images Directly [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-vision-model\#using-base64-to-upload-images-directly)

Here is how you can ask Kimi questions about an image using the following code:

```
import os
import base64

from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get("MOONSHOT_API_KEY"),
    base_url="https://api.moonshot.ai/v1",
)

# Replace kimi.png with the path to the image you want Kimi to recognize
image_path = "kimi.png"

with open(image_path, "rb") as f:
    image_data = f.read()

# We use the built-in base64.b64encode function to encode the image into a base64 formatted image_url
image_url = f"data:image/{os.path.splitext(image_path)[1]};base64,{base64.b64encode(image_data).decode('utf-8')}"


completion = client.chat.completions.create(
    model="kimi-k2.5",
    messages=[\
        {"role": "system", "content": "You are Kimi."},\
        {\
            "role": "user",\
            # Note here, the content has changed from the original str type to a list. This list contains multiple parts, with the image (image_url) being one part and the text (text) being another part.\
            "content": [\
                {\
                    "type": "image_url", # <-- Use the image_url type to upload the image, the content is the base64 encoded image\
                    "image_url": {\
                        "url": image_url,\
                    },\
                },\
                {\
                    "type": "text",\
                    "text": "Describe the content of the image.", # <-- Use the text type to provide text instructions, such as "Describe the content of the image"\
                },\
            ],\
        },\
    ],
)

print(completion.choices[0].message.content)
```

Note that when using the Vision model, the type of the `message.content` field has changed from `str` to `List[Dict]` (i.e., a JSON array). Additionally, do not serialize the JSON array and put it into `message.content` as a `str`. This will cause Kimi to fail to correctly identify the image type and may trigger the `Your request exceeded model token limit` error.

✅ Correct Format:

```
{
    "model": "kimi-k2.5",
    "messages":
    [\
        {\
            "role": "system",\
            "content": "You are Kimi, an AI assistant provided by Moonshot AI, who excels in Chinese and English conversations. You provide users with safe, helpful, and accurate answers. You will reject any questions related to terrorism, racism, or explicit content. Moonshot AI is a proper noun and should not be translated into other languages."\
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
    "temperature": 0.3
}
```

❌ Invalid Format：

```
{
    "model": "kimi-k2.5",
    "messages":
    [\
        {\
            "role": "system",\
            "content": "You are Kimi, an AI assistant provided by Moonshot AI. You are proficient in Chinese and English conversations. You provide users with safe, helpful, and accurate responses. You will refuse to answer any questions involving terrorism, racism, or explicit content. Moonshot AI is a proper noun and should not be translated into other languages."\
        },\
        {\
            "role": "user",\
            "content": "[{\"type\": \"image_url\", \"image_url\": {\"url\": \"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABhCAYAAAApxKSdAAAACXBIWXMAACE4AAAhOAFFljFgAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAUUSURBVHgB7Z29bhtHFIWPHQN2J7lKqnhYpYvpIukCbJEAKQJEegLReYFIT0DrCSI9QEDqCSIDaQIEIOukiJwyza5SJWlId3FFz+HuGmuSSw6p+dlZ3g84luhdUeI9M3fmziyXgBCUe/DHYY0Wj/tgWmjV42zFcWe4MIBBPNJ6qqW0uvAbXFvQgKzQK62bQhkaCIPc10q1Zi3XH1o/IG9cwUm0RogrgDY1KmLgHYX9DvyiBvDYI77XmiD+oLlQHw7hIDoCMBOt1U9w0BsU9mOAtaUUFk3oQoIfzAQFCf5dNMEdTFCQ4NtQih1NSIGgf3ibxOJt5UrAB1gNK72vIdjiI61HWr+YnNxDXK0rJiULsV65GJeiIescLSTTeobKSutiCuojX8kU3MBx4I3WeNVBBRl4fWiCyoB8v2JAAkk9PmDwT8sH1TEghRjgC27scCx41wO43KAg+ILxTvhNaUACwTc04Z0B30LwzTzm5Rjw3sgseIG1wGMawMBPIOQcqvzrNIMHOg9Q5KK953O90/rFC+BhJRH8PQZ+fu7SjC7HAIV95yu99vjlxfvBJx8nwHd6IfNJAkccOjHg6OgIs9lsra6vr2GTNE03/k7q8HAhyJ/2gM9O65/4kT7/mwEcoZwYsPQiV3BwcABb9Ho9KKU2njccDjGdLlxx+InBBPBAAR86ydRPaIC9SASi3+8bnXd+fr78nw8NJ39uDJjXAVFPP7dp/VmWLR9g6w6Huo/IOTk5MTpvZesn/93AiP/dXCwd9SyILT9Jko3n1bZ+8s8rGPGvoVHbEXcPMM39V1dX9Qd/19PPNxta959D4HUGF0RrAFs/8/8mxuPxXLUwtfx2WX+cxdivZ3DFA0SKldZPuPTAKrikbOlMOX+9zFu/Q2iAQoSY5H7mfeb/tXCT8MdneU9wNNCuQUXZA0ynnrUznyqOcrspUY4BJunHqPU3gOgMsNr6G0B0BpgUXrG0fhKVAaaF1/HxMWIhKgNMcj9Tz82Nk6rVGdav/tJ5eraJ0Wi01XPq1r/xOS8uLkJc6XYnRTMNXdf62eIvLy+jyftVghnQ7Xahe8FW59fBTRYOzosDNI1hJdz0lBQkBflkMBjMU5iL13pXRb8fYAJrB/a2db0oFHthAOEUliaYFHE+aaUBdZsvvFhApyM0idYZwOCvW4JmIWdSzPmidQaYrAGZ7iX4oFUGnJ2dGdUCTRqMozeANQCLsE6nA10JG/0Mx4KmDMbBCjEWR2yxu8LAM98vXelmCA2ovVLCI8EMYODWbpbvCXtTBzQVMSAwYkBgxIDAtNKAXWdGIRADAiMpKDA0IIMQikx6QGDEgMCIAYGRMSAsMgaEhgbcQgjFa+kBYZnIGBCWWzEgLPNBOJ6Fk/aR8Y5ZCvktKwX/PJZ7xoVjfs+4chYU11tK2sE85qUBLyH4Zh5z6QHhGPOf6r2j+TEbcgdFP2RaHX5TrYQlDflj5RXE5Q1cG/lWnhYpReUGKdUewGnRmhvnCJbgmxey8sHiZ8iwF3AsUBBckKHI/SWLq6HsBc8huML4DiK80D6WnBqLzN68UFCmopheYJOVYgcU5FOVbAVfYUcUZGoaLPglCtITdg2+tZUFBTFh2+ArWEYh/7z0WIIQSiM43lt5AWAmWhLHylN4QmkNEXfAbGqEQKsHSfHLYwiSq8AnaAAKeaW3D8VbijwNW5nh3IN9FPI/jnpaPKZi2/SfFuJu4W3x9RqWL+N5C+7ruKpBAgLkAAAAAElFTkSuQmCC\"}}, {\"type\": \"text\", \"text\": \"Please describe this image\"}]"\
        }\
    ],
    "temperature": 0.3
}
```

## Using Uploaded Images or Videos [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-vision-model\#using-uploaded-images-or-videos)

In the previous example, our `image_url` was a base64-encoded image. Since video files are often larger, we provide an additional method where you can first upload images or videos to Moonshot, then reference them via file ID. For information on uploading images or videos, please refer to [Image Understanding Upload](https://platform.moonshot.ai/docs/api/files.en-US)

```
import os
from pathlib import Path

from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get("MOONSHOT_API_KEY"),
    base_url="https://api.moonshot.cn/v1",
)

# Here, you need to replace video.mp4 with the path to the image or video you want Kimi to recognize
video_path = "video.mp4"

file_object = client.files.create(file=Path(video_path), purpose="video")  # Upload video to Moonshot

completion = client.chat.completions.create(
    model="kimi-k2.5",
    messages=[\
        {\
            "role": "system",\
            "content": "You are Kimi, an AI assistant provided by Moonshot AI, who excels in Chinese and English conversations. You provide users with safe, helpful, and accurate answers. You will refuse to answer any questions involving terrorism, racism, or explicit content. Moonshot AI is a proper noun and should not be translated into other languages."\
        },\
        {\
            "role": "user",\
            "content":\
            [\
                {\
                    "type": "video_url",\
                    "video_url":\
                    {\
                        "url": f"ms://{file_object.id}"  # Note this is ms:// instead of base64-encoded image\
                    }\
                },\
                {\
                    "type": "text",\
                    "text": "Please describe this video"\
                }\
            ]\
        }\
    ]
)

print(completion.choices[0].message.content)
```

Note that in the above example, the format of `video_url.url` is `ms://<file-id>`, where ms is short for moonshot storage, which is Moonshot's internal protocol for referencing files.

## Supported Formats [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-vision-model\#supported-formats)

Images support the following formats:

- png
- jpeg
- webp
- gif

Videos support the following formats:

- mp4
- mpeg
- mov
- avi
- x-flv
- mpg
- webm
- wmv
- 3gpp

## Token Calculation and Costs [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-vision-model\#token-calculation-and-costs)

Images and videos use dynamic token calculation. You can obtain the token consumption of a request containing images or videos through the [estimate tokens API](https://platform.moonshot.ai/docs/api/estimate.en-US) before starting the understanding process.

Generally speaking, the higher the image resolution, the more tokens it consumes. Videos are composed of several key frames. The more key frames and the higher the resolution, the more tokens are consumed.

The Vision model follows the same pricing model as the `moonshot-v1` series, with costs based on the total tokens used for model inference. For more details on token pricing, please refer to:

[Model Inference Pricing](https://platform.moonshot.ai/docs/pricing/chat.en-US)

## Best Practices [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-vision-model\#best-practices)

### Resolution [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-vision-model\#resolution)

We recommend that image resolution does not exceed 4k (4096×2160), and video resolution does not exceed 2k (2048×1080). Resolutions higher than recommended will only cost more time processing the input without improving model understanding performance.

### File Upload vs base64 [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-vision-model\#file-upload-vs-base64)

Due to our overall request body size limitations, very large videos should be processed using the file upload method for visual understanding.

For images or videos that need to be referenced multiple times, we recommend using the file upload method for visual understanding.

Regarding file upload limitations, please refer to the [File Upload](https://platform.moonshot.ai/docs/api/files.en-US) documentation.

## Features and Limitations [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-vision-model\#features-and-limitations)

The Vision model supports the following features:

- [x]  Multi-turn conversations
- [x]  Streaming output
- [x]  Tool invocation
- [x]  JSON Mode
- [x]  Partial Mode

The following features are not supported or only partially supported:

- URL-formatted images: Not supported, currently only supports base64-encoded image content and images/videos uploaded via file ID

Other limitations:

- Image quantity: The Vision model has no limit on the number of images, but ensure that the request body size does not exceed 100M.

## Parameters Differences in Request Body [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-vision-model\#parameters-differences-in-request-body)

Parameters are listed in [chat](https://platform.moonshot.ai/docs/api/chat.en-US#request-body). However, behaviour of some parameters may be different in k2.5 models.

**We recommend using the default values instead of manually configuring these parameters.**

Differences are listed below.

| Field | Required | Description | Type | Values |
| --- | --- | --- | --- | --- |
| max\_tokens | optional | The maximum number of tokens to generate for the chat completion. | int | Default to be 32k aka 32768 |
| thinking | optional | **New!** This parameter controls if the thinking is enabled for this request | object | Default to be `{"type": "enabled"}`. Value can only be one of `{"type": "enabled"}` or `{"type": "disabled"}` |
| temperature | optional | The sampling temperature to use | float | k2.5 model will use a fixed value 1.0, non-thinking mode will use a fixed value 0.6. Any other value will result in an error |
| top\_p | optional | A sampling method | float | k2.5 model will use a fixed value 0.95. Any other value will result in an error |
| n | optional | The number of results to generate for each input message | int | k2.5 model will use a fixed value 1. Any other value will result in an error |
| presence\_penalty | optional | Penalizing new tokens based on whether they appear in the text | float | k2.5 model will use a fixed value 0.0. Any other value will result in an error |
| frequency\_penalty | optional | Penalizing new tokens based on their existing frequency in the text | float | k2.5 model will use a fixed value 0.0. Any other value will result in an error |

## Advanced Usages [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-vision-model\#advanced-usages)

### Using vision models in Kimi Cli [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-vision-model\#using-vision-models-in-kimi-cli)

[Kimi Cli (opens in a new tab)](https://github.com/MoonshotAI/kimi-cli/) is an open source AI Agent by Moonshot.
Kimi Cli has become more powerful with the release of K2.5 model.
[Kimi Agent SDK (opens in a new tab)](https://github.com/MoonshotAI/kimi-agent-sdk/) can be used in your own code, using Kimi Cli more conveniently.

A tool, that can find the source of anime from a screenshot using Kimi Agent SDK is shown as below.
[anime-recognizer (opens in a new tab)](https://github.com/MoonshotAI/kimi-agent-sdk/tree/main/examples/go/anime-recognizer)

Last updated on January 26, 2026

# Use Kimi API for Tool Calls

_Tool calls, or `tool_calls`, evolved from function calls (`function_call`). In certain contexts, or when reading compatibility code, you can consider `tool_calls` and `function_call` to be the same. `function_call` is a subset of `tool_calls`._

## What are Tool Calls? [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-api-to-complete-tool-calls\#what-are-tool-calls)

Tool calls give the Kimi large language model the ability to perform specific actions. The Kimi large language model can engage in conversations and answer questions, which is its "talking" ability. Through tool calls, it also gains the ability to "do" things. With `tool_calls`, the Kimi large language model can help you search the internet, query databases, and even control smart home devices.

A tool call involves several steps:

1. Define the tool using JSON Schema format;
2. Submit the defined tool to the Kimi large language model via the `tools` parameter. You can submit multiple tools at once;
3. The Kimi large language model will decide which tool(s) to use based on the context of the current conversation. It can also choose not to use any tools;
4. The Kimi large language model will output the parameters and information needed to call the tool in JSON format;
5. Use the parameters output by the Kimi large language model to execute the corresponding tool and submit the results back to the Kimi large language model;
6. The Kimi large language model will respond to the user based on the results of the tool execution;

Reading the above steps, you might wonder:

> Why can't the Kimi large language model execute the tools itself? Why do we need to "help" the Kimi large language model execute the tools based on the parameters it generates? If we are the ones executing the tool calls, what is the role of the Kimi large language model?

We will use a practical example of a tool call to explain these questions to the reader.

## Enable the Kimi Large Language Model to Access the Internet via `tool_calls` [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-api-to-complete-tool-calls\#enable-the-kimi-large-language-model-to-access-the-internet-via-tool_calls)

The knowledge of the Kimi large language model comes from its training data. For questions that are time-sensitive, the Kimi large language model cannot find answers from its existing knowledge. In such cases, we want the Kimi large language model to search the internet for the latest information and answer our questions based on that information.

### Define the Tools [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-api-to-complete-tool-calls\#define-the-tools)

Imagine how we find the information we want on the internet:

1. We open a search engine, such as Baidu or Bing, and search for the content we want. We then browse the search results and decide which one to click based on the website title and description;
2. We might open one or more web pages from the search results and browse them to obtain the knowledge we need;

Reviewing our actions, we "use a search engine to search" and "open the web pages corresponding to the search results." The tools we use are the "search engine" and the "web browser." Therefore, we need to abstract these actions into tools in JSON Schema format and submit them to the Kimi large language model, allowing it to use search engines and browse web pages just like humans do.

Before we proceed, let's briefly introduce the JSON Schema format:

> [JSON Schema (opens in a new tab)](https://json-schema.org/) is a vocabulary that you can use to annotate and validate JSON documents.
>
> [JSON Schema (opens in a new tab)](https://json-schema.org/) is a JSON document used to describe the format of JSON data.

We define the following JSON Schema:

```
{
	"type": "object",
	"properties": {
		"name": {
			"type": "string"
		}
	}
}
```

This JSON Schema defines a JSON Object that contains a field named `name`, and the type of this field is `string`, for example:

```
{
	"name": "Hei"
}
```

By describing our tool definitions using JSON Schema, we can make it clearer and more intuitive for the Kimi large language model to understand what parameters our tools require, as well as the type and description of each parameter. Now let's define the "search engine" and "web browser" tools mentioned earlier:

pythonnode.js

```
tools = [\
	{\
		"type": "function", # The agreed-upon field type, currently supports function as a value\
		"function": { # When type is function, use the function field to define the specific function content\
			"name": "search", # The name of the function. Please use English letters, numbers, hyphens, and underscores as the function name\
			"description": """\
				Search for content on the internet using a search engine.\
\
				When your knowledge cannot answer the user's question, or when the user requests an online search, call this tool. Extract the content the user wants to search for from the conversation and use it as the value of the query parameter.\
				The search results include the website title, address (URL), and description.\
			""", # A description of the function, detailing its specific role and usage scenarios, to help the Kimi large language model correctly select which functions to use\
			"parameters": { # Use the parameters field to define the parameters the function accepts\
				"type": "object", # Always use type: object to make the Kimi large language model generate a JSON Object parameter\
				"required": ["query"], # Use the required field to tell the Kimi large language model which parameters are mandatory\
				"properties": { # The properties field contains the specific parameter definitions; you can define multiple parameters\
					"query": { # Here, the key is the parameter name, and the value is the specific definition of the parameter\
						"type": "string", # Use type to define the parameter type\
						"description": """\
							The content the user wants to search for, extracted from the user's question or conversation context.\
						""" # Use description to describe the parameter so that the Kimi large language model can better generate the parameter\
					}\
				}\
			}\
		}\
	},\
	{\
		"type": "function", # The agreed-upon field type, currently supports function as a value\
		"function": { # When type is function, use the function field to define the specific function content\
			"name": "crawl", # The name of the function. Please use English letters, numbers, hyphens, and underscores as the function name\
			"description": """\
				Retrieve web page content based on the website address (URL).\
			""", # A description of the function, detailing its specific role and usage scenarios, to help the Kimi large language model correctly select which functions to use\
			"parameters": { # Use the parameters field to define the parameters the function accepts\
				"type": "object", # Always use type: object to make the Kimi large language model generate a JSON Object parameter\
				"required": ["url"], # Use the required field to tell the Kimi large language model which parameters are mandatory\
				"properties": { # The properties field contains the specific parameter definitions; you can define multiple parameters\
					"url": { # Here, the key is the parameter name, and the value is the specific definition of the parameter\
						"type": "string", # Use type to define the parameter type\
						"description": """\
							The website address (URL) from which to retrieve content, usually obtained from search results.\
						""" # Use description to describe the parameter so that the Kimi large language model can better generate the parameter\
					}\
				}\
			}\
		}\
	}\
]
```

When defining tools using JSON Schema, we use the following fixed format:

```
{
	"type": "function",
	"function": {
		"name": "NAME",
		"description": "DESCRIPTION",
		"parameters": {
			"type": "object",
			"properties": {

			}
		}
	}
}
```

Here, `name`, `description`, and `parameters.properties` are defined by the tool provider. The `description` explains the specific function and when to use the tool, while `parameters` outlines the specific parameters needed to successfully call the tool, including parameter types and descriptions. **Ultimately, the Kimi large language model will generate a JSON Object that meets the defined requirements as the parameters (arguments) for the tool call based on the JSON Schema.**

### Register Tools [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-api-to-complete-tool-calls\#register-tools)

Let's try submitting the `search` tool to the Kimi large language model to see if it can correctly call the tool:

pythonnode.js

````
from openai import OpenAI


client = OpenAI(
    api_key="MOONSHOT_API_KEY", # Replace MOONSHOT_API_KEY with the API Key you obtained from the Kimi Open Platform
    base_url="https://api.moonshot.ai/v1",
)

tools = [\
	{\
		"type": "function", # The field "type" is a convention, currently supporting "function" as its value\
		"function": { # When "type" is "function", use the "function" field to define the specific function content\
			"name": "search", # The name of the function, please use English letters, numbers, plus hyphens and underscores as the function name\
			"description": """\
				Search for content on the internet using a search engine.\
\
				When your knowledge cannot answer the user's question, or when the user requests an online search, call this tool. Extract the content the user wants to search from the conversation as the value of the query parameter.\
				The search results include the website title, website address (URL), and website description.\
			""", # Description of the function, write the specific function and usage scenarios here so that the Kimi large language model can correctly choose which functions to use\
			"parameters": { # Use the "parameters" field to define the parameters accepted by the function\
				"type": "object", # Always use "type": "object" to make the Kimi large language model generate a JSON Object parameter\
				"required": ["query"], # Use the "required" field to tell the Kimi large language model which parameters are required\
				"properties": { # The specific parameter definitions are in "properties", you can define multiple parameters\
					"query": { # Here, the key is the parameter name, and the value is the specific definition of the parameter\
						"type": "string", # Use "type" to define the parameter type\
						"description": """\
							The content the user wants to search for, extract it from the user's question or chat context.\
						""" # Use "description" to describe the parameter so that the Kimi large language model can better generate the parameter\
					}\
				}\
			}\
		}\
	},\
	# {\
	# 	"type": "function", # The field "type" is a convention, currently supporting "function" as its value\
	# 	"function": { # When "type" is "function", use the "function" field to define the specific function content\
	# 		"name": "crawl", # The name of the function, please use English letters, numbers, plus hyphens and underscores as the function name\
	# 		"description": """\
	# 			Get the content of a webpage based on the website address (URL).\
	# 		""", // Description of the function, write the specific function and usage scenarios here so that the Kimi large language model can correctly choose which functions to use\
	# 		"parameters": { // Use the "parameters" field to define the parameters accepted by the function\
	# 			"type": "object", // Always use "type": "object" to make the Kimi large language model generate a JSON Object parameter\
	# 			"required": ["url"], // Use the "required" field to tell the Kimi large language model which parameters are required\
	# 			"properties": { // The specific parameter definitions are in "properties", you can define multiple parameters\
	# 				"url": { // Here, the key is the parameter name, and the value is the specific definition of the parameter\
	# 					"type": "string", // Use "type" to define the parameter type\
	# 					"description": """\
	# 						The website address (URL) of the content to be obtained, which can usually be obtained from the search results.\
	# 					""" // Use "description" to describe the parameter so that the Kimi large language model can better generate the parameter\
	# 				}\
	# 			}\
	# 		}\
	# 	}\
	# }\
]

```python
completion = client.chat.completions.create(
    model="kimi-k2-turbo-preview",
    messages=[\
        {"role": "system", "content": "You are Kimi, an AI assistant provided by Moonshot AI. You are proficient in Chinese and English conversations. You provide users with safe, helpful, and accurate answers. You refuse to answer any questions related to terrorism, racism, or explicit content. Moonshot AI is a proper noun and should not be translated."},\
        {"role": "user", "content": "Please search the internet for 'Context Caching' and tell me what it is."} # In the question, we ask Kimi large language model to search online\
    ],
    temperature=0.6,
    tools=tools, # <-- We pass the defined tools to Kimi large language model via the tools parameter
)

print(completion.choices[0].model_dump_json(indent=4))
````

When the above code runs successfully, we get the response from Kimi large language model:

```
{
    "finish_reason": "tool_calls",
    "message": {
        "content": "",
        "role": "assistant",
        "tool_calls": [\
            {\
                "id": "search:0",\
                "function": {\
                    "arguments": "{\n    \"query\": \"Context Caching\"\n}",\
                    "name": "search"\
                },\
                "type": "function",\
            }\
        ]
    }
}
```

Notice that in this response, the value of `finish_reason` is `tool_calls`, which means that the response is not the answer from Kimi large language model, but rather the tool that Kimi large language model has chosen to execute. You can determine whether the current response from Kimi large language model is a tool call `tool_calls` by checking the value of `finish_reason`.

In the `message` section, the `content` field is empty because the model is currently executing `tool_calls` and has not yet generated a response for the user. Meanwhile, a new field `tool_calls` has been added. The `tool_calls` field is a list that contains all the tool call information for this execution. This also indicates another characteristic of `tool_calls`: **the model can choose to call multiple tools at once, which can be different tools or the same tool with different parameters**. Each element in `tool_calls` represents a tool call. Kimi large language model generates a unique `id` for each tool call. The `function.name` field indicates the name of the function being executed, and the parameters are placed in `function.arguments`. The `arguments` parameter is a valid serialized JSON Object (additionally, the `type` parameter is currently a fixed value `function`).

Next, we should use the tool call parameters generated by Kimi large language model to execute the specific tools.

### Execute the Tools [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-api-to-complete-tool-calls\#execute-the-tools)

Kimi large language model does not execute the tools for us. We need to execute the parameters generated by Kimi large language model after receiving them. Before explaining how to execute the tools, let's first address the question we raised earlier:

> Why can't Kimi large language model execute the tools itself, but instead requires us to "help" it execute the tools based on the parameters generated by Kimi large language model? If we are the ones executing the tool calls, what is the purpose of Kimi large language model?

Let's imagine a scenario where we use Kimi large language model: **we provide users with a smart robot based on Kimi large language model. In this scenario, there are three roles: the user, the robot, and Kimi large language model. The user asks the robot a question, the robot calls the Kimi large language model API, and returns the API result to the user. When using `tool_calls`, the user asks the robot a question, the robot calls the Kimi API with `tools`, Kimi large language model returns the `tool_calls` parameters, the robot executes the `tool_calls`, submits the results back to the Kimi API, Kimi large language model generates the message to be returned to the user (`finish_reason=stop`), and only then does the robot return the message to the user.** Throughout this process, the entire `tool_calls` process is transparent and implicit to the user.

Returning to the question above, as users, we are not actually executing the tool calls, nor do we directly "see" the tool calls. Instead, the robot that provides us with the service is completing the tool calls and presenting us with the final response generated by Kimi large language model.

Let's explain how to execute the `tool_calls` returned by Kimi large language model from the perspective of the "robot":

pythonnode.js

```
from typing import *

import json

from openai import OpenAI


client = OpenAI(
    api_key="MOONSHOT_API_KEY", # Replace MOONSHOT_API_KEY with the API Key you obtained from the Kimi Open Platform
    base_url="https://api.moonshot.ai/v1",
)

tools = [\
	{\
		"type": "function", # The field type is agreed upon, and currently supports function as a value\
		"function": { # When type is function, use the function field to define the specific function content\
			"name": "search", # The name of the function, please use English letters, numbers, plus hyphens and underscores as the function name\
			"description": """\
				Search for content on the internet using a search engine.\
\
				When your knowledge cannot answer the user's question, or the user requests you to perform an online search, call this tool. Extract the content the user wants to search from the conversation as the value of the query parameter.\
				The search results include the title of the website, the website address (URL), and a brief introduction to the website.\
			""", # Introduction to the function, write the specific function here, as well as the usage scenario, so that the Kimi large language model can correctly choose which functions to use\
			"parameters": { # Use the parameters field to define the parameters accepted by the function\
				"type": "object", # Fixed use type: object to make the Kimi large language model generate a JSON Object parameter\
				"required": ["query"], # Use the required field to tell the Kimi large language model which parameters are required\
				"properties": { # The specific parameter definitions are in properties, and you can define multiple parameters\
					"query": { # Here, the key is the parameter name, and the value is the specific definition of the parameter\
						"type": "string", # Use type to define the parameter type\
						"description": """\
							The content the user wants to search for, extracted from the user's question or chat context.\
						""" # Use description to describe the parameter so that the Kimi large language model can better generate the parameter\
					}\
				}\
			}\
		}\
	},\
	{\
		"type": "function", # The field type is agreed upon, and currently supports function as a value\
		"function": { # When type is function, use the function field to define the specific function content\
			"name": "crawl", # The name of the function, please use English letters, numbers, plus hyphens and underscores as the function name\
			"description": """\
				Get the content of a webpage based on the website address (URL).\
			""", # Introduction to the function, write the specific function here, as well as the usage scenario, so that the Kimi large language model can correctly choose which functions to use\
			"parameters": { # Use the parameters field to define the parameters accepted by the function\
				"type": "object", # Fixed use type: object to make the Kimi large language model generate a JSON Object parameter\
				"required": ["url"], # Use the required field to tell the Kimi large language model which parameters are required\
				"properties": { # The specific parameter definitions are in properties, and you can define multiple parameters\
					"url": { # Here, the key is the parameter name, and the value is the specific definition of the parameter\
						"type": "string", # Use type to define the parameter type\
						"description": """\
							The website address (URL) of the content to be obtained, which can usually be obtained from the search results.\
						""" # Use description to describe the parameter so that the Kimi large language model can better generate the parameter\
					}\
				}\
			}\
		}\
	}\
]


def search_impl(query: str) -> List[Dict[str, Any]]:
    """
    search_impl uses a search engine to search for query. Most mainstream search engines (such as Bing) provide API calls. You can choose
    your preferred search engine API and place the website title, link, and brief introduction information from the return results in a dict to return.

    This is just a simple example, and you may need to write some authentication, validation, and parsing code.
    """
    r = httpx.get("https://your.search.api", params={"query": query})
    return r.json()


def search(arguments: Dict[str, Any]) -> Any:
    query = arguments["query"]
    result = search_impl(query)
    return {"result": result}


def crawl_impl(url: str) -> str:
    """
    crawl_url gets the content of a webpage based on the url.

    This is just a simple example. In actual web scraping, you may need to write more code to handle complex situations, such as asynchronously loaded data; and after obtaining
    the webpage content, you can clean the webpage content according to your needs, such as retaining only the text or removing unnecessary content (such as advertisements).
    """
    r = httpx.get(url)
    return r.text


def crawl(arguments: dict) -> str:
    url = arguments["url"]
    content = crawl_impl(url)
    return {"content": content}


# Map each tool name and its corresponding function through tool_map so that when the Kimi large language model returns tool_calls, we can quickly find the function to execute
tool_map = {
    "search": search,
    "crawl": crawl,
}

messages = [\
    {"role": "system",\
     "content": "You are Kimi, an artificial intelligence assistant provided by Moonshot AI. You are better at conversing in Chinese and English. You provide users with safe, helpful, and accurate answers. At the same time, you will refuse to answer any questions involving terrorism, racial discrimination, pornography, and violence. Moonshot AI is a proper noun and should not be translated into other languages."},\
    {"role": "user", "content": "Please search for Context Caching online and tell me what it is."}  # Request Kimi large language model to perform an online search in the question\
]

finish_reason = None


# Our basic process is to ask the Kimi large language model questions with the user's question and tools. If the Kimi large language model returns finish_reason: tool_calls, we execute the corresponding tool_calls,
# and submit the execution results in the form of a message with role=tool back to the Kimi large language model. The Kimi large language model then generates the next content based on the tool_calls results:
#
#   1. If the Kimi large language model believes that the current tool call results can answer the user's question, it returns finish_reason: stop, and we exit the loop and print out message.content;
#   2. If the Kimi large language model believes that the current tool call results cannot answer the user's question and needs to call the tool again, we continue to execute the next tool_calls in the loop until finish_reason is no longer tool_calls;
#
# During this process, we only return the result to the user when finish_reason is stop.

while finish_reason is None or finish_reason == "tool_calls":
    completion = client.chat.completions.create(
        model="kimi-k2-turbo-preview",
        messages=messages,
        temperature=0.6,
        tools=tools,  # <-- We submit the defined tools to the Kimi large language model through the tools parameter
    )
    choice = completion.choices[0]
    finish_reason = choice.finish_reason
    if finish_reason == "tool_calls": # <-- Determine whether the current return content contains tool_calls
        messages.append(choice.message) # <-- We add the assistant message returned to us by the Kimi large language model to the context so that the Kimi large language model can understand our request next time
        for tool_call in choice.message.tool_calls: # <-- tool_calls may be multiple, so we use a loop to execute them one by one
            tool_call_name = tool_call.function.name
            tool_call_arguments = json.loads(tool_call.function.arguments) # <-- arguments is a serialized JSON Object, and we need to deserialize it with json.loads
            tool_function = tool_map[tool_call_name] # <-- Quickly find which function to execute through tool_map
            tool_result = tool_function(tool_call_arguments)

            # Construct a message with role=tool using the function execution result to show the result of the tool call to the model;
            # Note that we need to provide the tool_call_id and name fields in the message so that the Kimi large language model
            # can correctly match the corresponding tool_call.
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "name": tool_call_name,
                "content": json.dumps(tool_result), # <-- We agree to submit the tool call result to the Kimi large language model in string format, so we use json.dumps to serialize the execution result into a string here
            })

print(choice.message.content) # <-- Here, we return the reply generated by the model to the user
```

We use a `while` loop to execute the code logic that includes tool calls because the Kimi large language model typically doesn't make just one tool call, especially in the context of online searching. Usually, Kimi will first call the `search` tool to get search results, and then call the `crawl` tool to convert the URLs in the search results into actual web page content. The overall structure of the `messages` is as follows:

```
system: prompt                                                                                               # System prompt
user: prompt                                                                                                 # User's question
assistant: tool_call(name=search, arguments={query: query})                                                  # Kimi returns a tool_call (single)
tool: search_result(tool_call_id=tool_call.id, name=search)                                                  # Submit the tool_call execution result
assistant: tool_call_1(name=crawl, arguments={url: url_1}), tool_call_2(name=crawl, arguments={url: url_2})  # Kimi continues to return tool_calls (multiple)
tool: crawl_content(tool_call_id=tool_call_1.id, name=crawl)                                                 # Submit the execution result of tool_call_1
tool: crawl_content(tool_call_id=tool_call_2.id, name=crawl)                                                 # Submit the execution result of tool_call_2
assistant: message_content(finish_reason=stop)                                                               # Kimi generates a reply to the user, ending the conversation
```

This completes the entire process of making "online query" tool calls. If you have implemented your own `search` and `crawl` methods, when you ask Kimi to search online, it will call the `search` and `crawl` tools and give you the correct response based on the tool call results.

## Common Questions and Notes [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-api-to-complete-tool-calls\#common-questions-and-notes)

### About Streaming Output [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-api-to-complete-tool-calls\#about-streaming-output)

In streaming output mode (`stream`), `tool_calls` are still applicable, but there are some additional things to note, as follows:

- During streaming output, since `finish_reason` will appear in the last data chunk, it is recommended to check if the `delta.tool_calls` field exists to determine if the current response includes a tool call;
- During streaming output, `delta.content` will be output first, followed by `delta.tool_calls`, so you must wait until `delta.content` has finished outputting before you can determine and identify `tool_calls`;
- During streaming output, we will specify the `tool_call.id` and `tool_call.function.name` in the initial data chunk, and only `tool_call.function.arguments` will be output in subsequent chunks;
- During streaming output, if Kimi returns multiple `tool_calls` at once, we will use an additional field called `index` to indicate the index of the current `tool_call`, so that you can correctly concatenate the `tool_call.function.arguments` parameters. We use a code example from the streaming output section (without using the SDK) to illustrate how to do this:

pythonnode.js

```
import os
import json
import httpx  # We use the httpx library to make our HTTP requests



tools = [\
    {\
        "type": "function",  # The type field is fixed as "function"\
        "function": {  # When type is "function", use the function field to define the specific function content\
            "name": "search",  # The name of the function, please use English letters, numbers, hyphens, and underscores\
            "description": """\
				Search the internet for content using a search engine.\
\
				When your knowledge cannot answer the user's question or the user requests an online search, call this tool. Extract the content the user wants to search from the conversation as the value of the query parameter.\
				The search results include the title of the website, the website's address (URL), and a brief introduction to the website.\
			""",  # Description of the function, explaining its specific role and usage scenarios to help the Kimi large language model choose the right functions\
            "parameters": {  # Use the parameters field to define the parameters the function accepts\
                "type": "object",  # Always use type: object to make the Kimi large language model generate a JSON Object parameter\
                "required": ["query"],  # Use the required field to tell the Kimi large language model which parameters are mandatory\
                "properties": {  # Specific parameter definitions in properties, you can define multiple parameters\
                    "query": {  # Here, the key is the parameter name, and the value is the specific definition of the parameter\
                        "type": "string",  # Use type to define the parameter type\
                        "description": """\
							The content the user wants to search for, extracted from the user's question or chat context.\
						"""  # Use description to help the Kimi large language model generate parameters more effectively\
                    }\
                }\
            }\
        }\
    },\
]

header = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {os.environ.get('MOONSHOT_API_KEY')}",
}

data = {
    "model": "kimi-k2-turbo-preview",
    "messages": [\
        {"role": "user", "content": "Please search for Context Caching technology online."}\
    ],
    "temperature": 0.6,
    "stream": True,
    "n": 2,  # <-- Note here, we require the Kimi large language model to output 2 responses
    "tools": tools,  # <-- Add tool invocation
}
# Use httpx to send a chat request to the Kimi large language model and get the response r
r = httpx.post("https://api.moonshot.ai/v1/chat/completions",
               headers=header,
               json=data)
if r.status_code != 200:
    raise Exception(r.text)

data: str

# Here, we pre-build a List to store different response messages. Since we set n=2, we initialize the List with 2 elements
messages = [{}, {}]

# Here, we use the iter_lines method to read the response body line by line
for line in r.iter_lines():
    # Remove leading and trailing spaces from each line to better handle data blocks
    line = line.strip()

    # Next, we need to handle three different cases:
    #   1. If the current line is empty, it indicates that the previous data block has been received (as mentioned earlier, data blocks are ended with two newline characters). We can deserialize the data block and print the corresponding content;
    #   2. If the current line is not empty and starts with data:, it indicates the start of a data block transmission. After removing the data: prefix, first check if it is the end marker [DONE]. If not, save the data content to the data variable;
    #   3. If the current line is not empty but does not start with data:, it means the current line still belongs to the previous data block being transmitted. Append the content of the current line to the end of the data variable;

    if len(line) == 0:
        chunk = json.loads(data)

        # Loop through all choices in each data block to get the message object corresponding to the index
        for choice in chunk["choices"]:
            index = choice["index"]
            message = messages[index]
            usage = choice.get("usage")
            if usage:
                message["usage"] = usage
            delta = choice["delta"]
            role = delta.get("role")
            if role:
                message["role"] = role
            content = delta.get("content")
            if content:
            	if "content" not in message:
            		message["content"] = content
            	else:
                	message["content"] = message["content"] + content

            # From here, we start processing tool_calls
            tool_calls = delta.get("tool_calls")  # <-- First, check if the data block contains tool_calls
            if tool_calls:
                if "tool_calls" not in message:
                    message["tool_calls"] = []  # <-- If it contains tool_calls, initialize a list to store these tool_calls. Note that the list is empty at this point, with a length of 0
                for tool_call in tool_calls:
                    tool_call_index = tool_call["index"]  # <-- Get the index of the current tool_call
                    if len(message["tool_calls"]) < (
                            tool_call_index + 1):  # <-- Expand the tool_calls list according to the index to access the corresponding tool_call via index
                        message["tool_calls"].extend([{}] * (tool_call_index + 1 - len(message["tool_calls"])))
                    tool_call_object = message["tool_calls"][tool_call_index]  # <-- Access the corresponding tool_call via index
                    tool_call_object["index"] = tool_call_index

                    # The following steps fill in the id, type, and function fields of each tool_call based on the information in the data block
                    # In the function field, there are name and arguments fields. The arguments field will be supplemented by each data block
                    # in the same way as the delta.content field.

                    tool_call_id = tool_call.get("id")
                    if tool_call_id:
                        tool_call_object["id"] = tool_call_id
                    tool_call_type = tool_call.get("type")
                    if tool_call_type:
                        tool_call_object["type"] = tool_call_type
                    tool_call_function = tool_call.get("function")
                    if tool_call_function:
                        if "function" not in tool_call_object:
                            tool_call_object["function"] = {}
                        tool_call_function_name = tool_call_function.get("name")
                        if tool_call_function_name:
                            tool_call_object["function"]["name"] = tool_call_function_name
                        tool_call_function_arguments = tool_call_function.get("arguments")
                        if tool_call_function_arguments:
                            if "arguments" not in tool_call_object["function"]:
                                tool_call_object["function"]["arguments"] = tool_call_function_arguments
                            else:
                                tool_call_object["function"]["arguments"] = tool_call_object["function"][\
                                                                            "arguments"] + tool_call_function_arguments  # <-- Supplement the value of the function.arguments field sequentially
                    message["tool_calls"][tool_call_index] = tool_call_object

            data = ""  # Reset data
    elif line.startswith("data: "):
        data = line.lstrip("data: ")

        # When the data block content is [DONE], it indicates that all data blocks have been sent and the network connection can be disconnected
        if data == "[DONE]":
            break
    else:
        data = data + "\n" + line  # When appending content, add a newline character because this might be intentional line breaks in the data block

# After assembling all messages, print their contents separately
for index, message in enumerate(messages):
    print("index:", index)
    print("message:", json.dumps(message, ensure_ascii=False))
    print("")
```

Below is an example of handling `tool_calls` in streaming output using the openai SDK:

pythonnode.js

```
import os
import json

from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get("MOONSHOT_API_KEY"),
    base_url="https://api.moonshot.ai/v1",
)

tools = [\
    {\
        "type": "function",  # The agreed-upon field type, currently supports function as a value\
        "function": {  # When type is function, use the function field to define the specific function content\
            "name": "search",  # The name of the function, please use English letters, numbers, plus hyphens and underscores as the function name\
            "description": """\
				Search for content on the internet using a search engine.\
\
				When your knowledge cannot answer the user's question, or the user requests you to perform an online search, call this tool. Please extract the content the user wants to search from the conversation with the user as the value of the query parameter.\
				The search results include the title of the website, the website's address (URL), and the website's description.\
			""",  # The introduction of the function, write the specific function here and its usage scenarios so that the Kimi large language model can correctly choose which functions to use\
            "parameters": {  # Use the parameters field to define the parameters accepted by the function\
                "type": "object",  # Fixed use type: object to make the Kimi large language model generate a JSON Object parameter\
                "required": ["query"],  # Use the required field to tell the Kimi large language model which parameters are required\
                "properties": {  # The properties are the specific parameter definitions, you can define multiple parameters\
                    "query": {  # Here, the key is the parameter name, and the value is the specific definition of the parameter\
                        "type": "string",  # Use type to define the parameter type\
                        "description": """\
							The content the user is searching for, please extract it from the user's question or chat context.\
						"""  # Use description to describe the parameter so that the Kimi large language model can better generate the parameter\
                    }\
                }\
            }\
        }\
    },\
]

completion = client.chat.completions.create(
    model="kimi-k2-turbo-preview",
    messages=[\
        {"role": "user", "content": "Please search for Context Caching technology online."}\
    ],
    temperature=0.6,
    stream=True,
    n=2,  # <-- Note here, we require the Kimi large language model to output 2 responses
    tools=tools,  # <-- Add tool invocation
)

# Here, we pre-build a List to store different response messages, since we set n=2, we initialize the List with 2 elements
messages = [{}, {}]

for chunk in completion:
    # Loop through all the choices in each data chunk and get the message object corresponding to the index
    for choice in chunk.choices:
        index = choice.index
        message = messages[index]
        delta = choice.delta
        role = delta.role
        if role:
            message["role"] = role
        content = delta.content
        if content:
        	if "content" not in message:
        		message["content"] = content
        	else:
            	message["content"] = message["content"] + content

        # From here, we start processing tool_calls
        tool_calls = delta.tool_calls  # <-- First check if the data chunk contains tool_calls
        if tool_calls:
            if "tool_calls" not in message:
                message["tool_calls"] = []  # <-- If it contains tool_calls, we initialize a list to save these tool_calls, note that the list is empty at this time with a length of 0
            for tool_call in tool_calls:
                tool_call_index = tool_call.index  # <-- Get the index of the current tool_call
                if len(message["tool_calls"]) < (
                        tool_call_index + 1):  # <-- Expand the tool_calls list according to the index so that we can access the corresponding tool_call via the subscript
                    message["tool_calls"].extend([{}] * (tool_call_index + 1 - len(message["tool_calls"])))
                tool_call_object = message["tool_calls"][tool_call_index]  # <-- Access the corresponding tool_call via the subscript
                tool_call_object["index"] = tool_call_index

                # The following steps are to fill in the id, type, and function fields of each tool_call based on the information in the data chunk
                # In the function field, there are name and arguments fields, the arguments field will be supplemented by each data chunk
                # Sequentially, just like the delta.content field.

                tool_call_id = tool_call.id
                if tool_call_id:
                    tool_call_object["id"] = tool_call_id
                tool_call_type = tool_call.type
                if tool_call_type:
                    tool_call_object["type"] = tool_call_type
                tool_call_function = tool_call.function
                if tool_call_function:
                    if "function" not in tool_call_object:
                        tool_call_object["function"] = {}
                    tool_call_function_name = tool_call_function.name
                    if tool_call_function_name:
                        tool_call_object["function"]["name"] = tool_call_function_name
                    tool_call_function_arguments = tool_call_function.arguments
                    if tool_call_function_arguments:
                        if "arguments" not in tool_call_object["function"]:
                            tool_call_object["function"]["arguments"] = tool_call_function_arguments
                        else:
                            tool_call_object["function"]["arguments"] = tool_call_object["function"][\
                                                                            "arguments"] + tool_call_function_arguments  # <-- Sequentially supplement the value of the function.arguments field
                message["tool_calls"][tool_call_index] = tool_call_object

# After assembling all messages, we print their contents separately
for index, message in enumerate(messages):
    print("index:", index)
    print("message:", json.dumps(message, ensure_ascii=False))
    print("")
```

### About `tool_calls` and `function_call` [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-api-to-complete-tool-calls\#about-tool_calls-and-function_call)

`tool_calls` is an advanced version of `function_call`. Since OpenAI has marked parameters such as `function_call` (for example, `functions`) as "deprecated," our API will no longer support `function_call`. You can consider using `tool_calls` instead of `function_call`. Compared to `function_call`, `tool_calls` has the following advantages:

- It supports parallel calls. The Kimi large language model can return multiple `tool_calls` at once. You can use concurrency in your code to call these `tool_call` simultaneously, reducing time consumption;
- For `tool_calls` that have no dependencies, the Kimi large language model will also tend to call them in parallel. Compared to the original sequential calls of `function_call`, this reduces token consumption to some extent;

### About `content` [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-api-to-complete-tool-calls\#about-content)

When using the `tool_calls` tool, you may notice that under the condition of `finish_reason=tool_calls`, the `message.content` field is occasionally not empty. Typically, the `content` here is the Kimi large language model explaining which tools need to be called and why these tools need to be called. Its significance lies in the fact that if your tool call process takes a long time, or if completing a round of chat requires multiple sequential tool calls, providing a descriptive sentence to the user before calling the tool can reduce the anxiety or dissatisfaction that users may feel due to waiting. Additionally, explaining to the user which tools are being called and why helps them understand the entire tool call process and allows them to intervene and correct in a timely manner (for example, if the user thinks the current tool selection is incorrect, they can terminate the tool call in time, or correct the model's tool selection in the next round of chat through a prompt).

### About Tokens [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-api-to-complete-tool-calls\#about-tokens)

The content in the `tools` parameter is also counted in the total Tokens. Please ensure that the total number of Tokens in `tools` and `messages` does not exceed the model's context window size.

### About Message Layout [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-api-to-complete-tool-calls\#about-message-layout)

In scenarios where tools are called, our messages are no longer laid out like this:

```
system: ...
user: ...
assistant: ...
user: ...
assistant: ...
```

Instead, they will look like this:

```
system: ...
user: ...
assistant: ...
tool: ...
tool: ...
assistant: ...
```

It is important to note that when the Kimi large language model generates `tool_calls`, ensure that each `tool_call` has a corresponding message with `role=tool`, and that this message has the correct `tool_call_id`. If the number of `role=tool` messages does not match the number of `tool_calls`, or if the `tool_call_id` in the `role=tool` messages cannot be matched with the `tool_call.id` in `tool_calls`, an error will occur.

### If You Encounter the `tool_call_id not found` Error [Permalink for this section](https://platform.moonshot.ai/docs/guide/use-kimi-api-to-complete-tool-calls\#if-you-encounter-the-tool_call_id-not-found-error)

If you encounter the `tool_call_id not found` error, it may be because you did not add the `role=assistant` message returned by the Kimi API to the messages list. The correct message sequence should look like this:

```
system: ...
user: ...
assistant: ...  # <-- Perhaps you did not add this assistant message to the messages list
tool: ...
tool: ...
assistant: ...
```

You can avoid the `tool_call_id not found` error by executing `messages.append(message)` each time you receive a return value from the Kimi API, to add the message returned by the Kimi API to the messages list.

_Note: Assistant messages added to the messages list before the `role=tool` message must fully include the `tool_calls` field and its values returned by the Kimi API. We recommend directly adding the `choice.message` returned by the Kimi API to the messages list "as is" to avoid potential errors._

Last updated on January 26, 2026

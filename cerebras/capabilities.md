# Reasoning

> Reasoning models generate intermediate thinking tokens before their final response, enabling better problem-solving and allowing you to inspect the model's thought process.

<Note>
  Reasoning capabilities are currently available for the [OpenAI GPT OSS](/models/openai-oss) (`gpt-oss-120b`), [Qwen3](/models/qwen-3-32b) (`qwen3-32b`), and [Z.ai GLM](/models/zai-glm-47) (`zai-glm-4.7`) models. Each model family has slight variations in the parameters used to control reasoning.
</Note>

## Reasoning Format

Control how reasoning text appears in responses using the `reasoning_format` parameter.

### Available Formats

| Format   | Description                                                                                                           |
| -------- | --------------------------------------------------------------------------------------------------------------------- |
| `parsed` | Reasoning returned in separate `reasoning` field; logprobs separated into `reasoning_logprobs`                        |
| `raw`    | Reasoning prepended to content; GLM and Qwen use `<think>...</think>` tokens, GPT-OSS concatenates without separators |
| `hidden` | Reasoning text and logprobs dropped completely (tokens still counted)                                                 |
| `none`   | Uses model's default behavior                                                                                         |

### Default Behavior by Model

When `reasoning_format` is set to `none` or omitted, each model uses its default format:

| Model   | Default Reasoning Format                |
| ------- | --------------------------------------- |
| Qwen3   | `raw` (`hidden` for JSON object/schema) |
| GLM     | `text_parsed`                           |
| GPT-OSS | `text_parsed`                           |

### `parsed` Format

Reasoning text is returned in a separate `reasoning` field without start/end tokens. When logprobs are enabled, reasoning logprobs are returned in a separate `reasoning_logprobs` field.

<CodeGroup>
  ```python Request theme={null}
  from cerebras.cloud.sdk import Cerebras

  client = Cerebras()

  response = client.chat.completions.create(
      model="zai-glm-4.7",
      messages=[
          {
              "role": "user",
              "content": "Can you help me with this?"
          }
      ],
      logprobs=True,
      reasoning_format="parsed"
  )

  print(response)
  ```

  ```json Non-streaming Response theme={null}
  {
    "choices": [
      {
        "index": 0,
        "message": {
          "role": "assistant",
          "content": "I can help you with that!",
          "reasoning": "Let me think..."
        },
        "logprobs": {
          "content": [
            {"token": "I", "logprob": -0.1},
            {"token": " can", "logprob": -0.2},
            ...
          ]
        },
        "reasoning_logprobs": {
          "content": [
            {"token": "Let ", "logprob": -0.3},
            {"token": "me", "logprob": -0.4},
            ...
          ]
        },
        "finish_reason": "stop"
      }
    ]
  }
  ```

  ```json Streaming Response theme={null}
  {
    "choices": [
      {
        "delta": {
          "reasoning": " should"
        },
        "index": 0
      }
    ]
  }
  ```
</CodeGroup>

When streaming, reasoning tokens are delivered in the `reasoning` field of the delta.

### `raw` Format

Reasoning text is included in the `content` field, prepended to the response. For GLM and Qwen models, reasoning is wrapped in `<think>...</think>` tokens. All logprobs are returned together in the standard `logprobs` field.

<Note>
  Since GPT-OSS does not use thinking tokens, reasoning and content are concatenated without separators when using `raw` format.
</Note>

<Note>
  The `raw` format is not compatible with `json_object` or `json_schema` response formats. Models that default to `raw` will automatically use `hidden` instead when structured output is requested.
</Note>

<CodeGroup>
  ```python Request theme={null}
  from cerebras.cloud.sdk import Cerebras

  client = Cerebras()

  response = client.chat.completions.create(
      model="zai-glm-4.7",
      messages=[
          {
              "role": "user",
              "content": "Can you help me with this?"
          }
      ],
      logprobs=True,
      reasoning_format="raw"
  )

  print(response)
  ```

  ```json Response theme={null}
  {
    "choices": [
      {
        "index": 0,
        "message": {
          "role": "assistant",
          "content": "<think>Let me think...</think>I can help you with that!"
        },
        "logprobs": {
          "content": [
            {"token": "Let ", "logprob": -0.3},
            {"token": "me", "logprob": -0.4},
            {"token": "I", "logprob": -0.1},
            {"token": " can", "logprob": -0.2},
            ...
          ]
        },
        "finish_reason": "stop"
      }
    ]
  }
  ```
</CodeGroup>

### `hidden` Format

Reasoning text and reasoning logprobs are dropped completely from the response. The reasoning tokens are still generated and counted toward total completion tokens.

<CodeGroup>
  ```python Request theme={null}
  from cerebras.cloud.sdk import Cerebras

  client = Cerebras()

  response = client.chat.completions.create(
      model="zai-glm-4.7",
      messages=[
          {
              "role": "user",
              "content": "Can you help me with this?"
          }
      ],
      logprobs=True,
      reasoning_format="hidden"
  )

  print(response)
  ```

  ```json Response theme={null}
  {
    "choices": [
      {
        "index": 0,
        "message": {
          "role": "assistant",
          "content": "I can help you with that!"
        },
        "logprobs": {
          "content": [
            {"token": "I", "logprob": -0.1},
            {"token": " can", "logprob": -0.2},
            ...
          ]
        },
        "finish_reason": "stop"
      }
    ]
  }
  ```
</CodeGroup>

***

## Model-Specific Parameters

Each model family has its own parameter for controlling reasoning behavior.

<Note>
  There are key differences between the OpenAI client and the Cerebras SDK when using non-standard OpenAI parameters. These examples use the Cerebras SDK. For more info, see [Passing Non-Standard Parameters](/resources/openai#passing-non-standard-parameters).
</Note>

### GPT-OSS: `reasoning_effort`

Use `reasoning_effort` to control how much reasoning the model performs:

* `"low"` - Minimal reasoning, faster responses
* `"medium"` - Moderate reasoning (default)
* `"high"` - Extensive reasoning, more thorough analysis

<CodeGroup>
  ```python Python theme={null}
  response = client.chat.completions.create(
      model="gpt-oss-120b",
      messages=[{"role": "user", "content": "Explain quantum entanglement."}],
      reasoning_effort="medium"
  )
  ```

  ```javascript Node.js theme={null}
  const response = await client.chat.completions.create({
      model: "gpt-oss-120b",
      messages: [{ role: "user", content: "Explain quantum entanglement." }],
      reasoning_effort: "medium"
  });
  ```
</CodeGroup>

### GLM: `disable_reasoning`

Use `disable_reasoning` to toggle reasoning on or off. Set to `true` to disable reasoning, or `false` (default) to enable it.

<CodeGroup>
  ```python Python theme={null}
  response = client.chat.completions.create(
      model="zai-glm-4.7",
      messages=[{"role": "user", "content": "Explain how photosynthesis works."}],
      disable_reasoning=False  # Set to True to disable reasoning
  )
  ```

  ```javascript Node.js theme={null}
  const response = await client.chat.completions.create({
      model: "zai-glm-4.7",
      messages: [{ role: "user", content: "Explain how photosynthesis works." }],
      disable_reasoning: false  // Set to true to disable reasoning
  });
  ```
</CodeGroup>

***

## Reasoning Context Retention

Reasoning tokens are not automatically retained across requests. To maintain awareness of prior reasoning in multi-turn conversations, include the reasoning text in the `content` field of the `assistant` message.

Use the same format the model outputs: for GLM and Qwen, include reasoning in `<think>...</think>` tags; for GPT-OSS, prepend reasoning text directly before the answer.

<Tabs>
  <Tab title="GPT-OSS">
    <CodeGroup>

      ```javascript Node.js theme={null}
      // GPT-OSS: reasoning prepended directly before the answer
      const response = await client.chat.completions.create({
          model: "gpt-oss-120b",
          messages: [
              { role: "user", content: "What is 25 * 4?" },
              { role: "assistant", content: "I need to multiply 25 by 4. 25 * 4 = 100. The answer is 100." },
              { role: "user", content: "Now divide that by 2." }
          ]
      });
      ```
    </CodeGroup>
  </Tab>

  <Tab title="GLM / Qwen">
    <CodeGroup>
      ```python Python theme={null}
      # GLM/Qwen: reasoning wrapped in <think> tags
      response = client.chat.completions.create(
          model="zai-glm-4.7",
          messages=[
              {"role": "user", "content": "What is 25 * 4?"},
              {"role": "assistant", "content": "<think>I need to multiply 25 by 4. 25 * 4 = 100.</think>The answer is 100."},
              {"role": "user", "content": "Now divide that by 2."}
          ]
      )
      ```

      ```javascript Node.js theme={null}
      // GLM/Qwen: reasoning wrapped in <think> tags
      const response = await client.chat.completions.create({
          model: "zai-glm-4.7",
          messages: [
              { role: "user", content: "What is 25 * 4?" },
              { role: "assistant", content: "<think>I need to multiply 25 by 4. 25 * 4 = 100.</think>The answer is 100." },
              { role: "user", content: "Now divide that by 2." }
          ]
      });
      ```
    </CodeGroup>
  </Tab>
</Tabs>

# Streaming Responses

> Learn how to enable streaming responses in the Cerebras API.

<Tip>**To get started with a free API key, [click here](https://cloud.cerebras.ai?utm_source=3pi_streaming\&utm_campaign=capabilities).**</Tip>

The Cerebras API supports streaming responses, allowing messages to be sent back in chunks and displayed incrementally as they are generated. To enable this feature, set the `stream` parameter to `True` within the `chat.completions.create` method. This will result in the API returning an iterable containing the chunks of the message.

Similarly, the same can be done in TypeScript by setting the `stream` property to `true` within the `chat.completions.create` method.

<Steps>
  <Step title="Initial Setup">
    Begin by importing the Cerebras SDK and setting up the client.

    <CodeGroup>

      ```javascript Node.js theme={null}
      import Cerebras from 'cerebras_cloud_sdk';

      const client = new Cerebras({
        apiKey: process.env['CEREBRAS_API_KEY'], // This is the default and can be omitted
      });
      ```
    </CodeGroup>
  </Step>

  <Step title="Streaming Responses">
    Set the `stream` parameter to `True` within the `chat.completions.create` method to enable streaming responses.

    <CodeGroup>

      ```javascript Node.js theme={null}
      import Cerebras from 'cerebras_cloud_sdk';

      const client = new Cerebras({
        apiKey: process.env['CEREBRAS_API_KEY'], // This is the default and can be omitted
      });

      async function main() {
        const stream = await client.chat.completions.create({
          messages: [{ role: 'user', content: 'Why is fast inference important?' }],
          model: 'llama-3.3-70b',
          stream: true,
        });
        for await (const chunk of stream) {
          process.stdout.write(chunk.choices[0]?.delta?.content || '');
        }
      }

      main();
      ```
    </CodeGroup>
  </Step>
</Steps>


# Structured Outputs

> Generate structured data with the Cerebras Inference API

<Tip>
  [**To get started with a free API key, click here.**](https://cloud.cerebras.ai?utm_source=inferencedocs)
</Tip>

Structured outputs is a feature that can enforce consistent JSON outputs for models in the Cerebras Inference API. This is particularly useful when building applications that need to process AI-generated data programmatically. Some of the key benefits of using structured outputs are:

* **Reduced Variability**: Ensures consistent outputs by adhering to predefined fields.
* **Type Safety**: Enforces correct data types, preventing mismatches.
* **Easier Parsing & Integration**: Enables direct use in applications without extra processing.

## Tutorial: Structured Outputs using Cerebras Inference

In this tutorial, we'll explore how to use structured outputs with the Cerebras Cloud SDK. We'll build a simple application that generates movie recommendations and uses structured outputs to ensure the response is in a consistent JSON format.

<Steps>
  <Step title="Initial Setup">
    First, ensure that you have completed steps 1 and 2 of our [Quickstart Guide](/quickstart) to set up your API key and install the Cerebras Cloud SDK.

    Then, initialize the Cerebras client and import the necessary modules we will use in this tutorial.

    <CodeGroup>
      ```python Python theme={null}
      import os
      from cerebras.cloud.sdk import Cerebras
      import json

      client = Cerebras(
          api_key=os.environ.get("CEREBRAS_API_KEY")
      )
      ```

      ```javascript Node.js theme={null}
      import Cerebras from '@cerebras/cerebras_cloud_sdk';

      const client = new Cerebras({
        apiKey: process.env['CEREBRAS_API_KEY']
      });
      ```
    </CodeGroup>
  </Step>

  <Step title="Defining the Schema">
    To ensure structured responses from the model, we'll use a JSON schema to define our output structure. Start by defining your schema, which specifies the fields, their types, and which ones are required. For our example, we'll define a schema for a movie recommendation that includes the title, director, and year:

    <Warning>
      Note: For every `required` array you define in your schema, you must set `additionalProperties` to `false`.
    </Warning>

    <CodeGroup>

      ```javascript Node.js theme={null}
      const movieSchema = {
          type: "object",
          properties: {
              title: { type: "string" },
              director: { type: "string" }, 
              year: { type: "integer" },
          },
          required: ["title", "director", "year"],
          additionalProperties: false
      };
      ```
    </CodeGroup>
  </Step>

  <Step title="Using Structured Outputs">
    Next, use the schema in your API call by setting the `response_format` parameter to include both the type and your schema. Setting `strict` to `true` will enforce the schema. Setting `strict` to `false` will allow the model to return additional fields that are not specified in the schema, similar to [JSON mode](#json-mode).

    <CodeGroup>

      ```javascript Node.js theme={null}
      async function main() {
        const schemaCompletion = await client.chat.completions.create({
          model: 'gpt-oss-120b',
          messages: [
            { role: 'system', content: 'You are a helpful assistant that generates movie recommendations.' },
            { role: 'user', content: 'Suggest a sci-fi movie from the 1990s' }
          ],
          response_format: {
            type: 'json_schema', 
            json_schema: {
              name: 'movie_schema',
              strict: true,
              schema: movieSchema
            }
          }
        });
        
        // Parse and display the JSON response 
        const schemaMovieData = JSON.parse(schemaCompletion.choices[0].message.content);
        console.log('Movie Recommendation:');
        console.log(JSON.stringify(schemaMovieData, null, 2));
      }
      ```
    </CodeGroup>

    Sample output:

    ```
    {
      "title": "Terminator 2: Judgment Day",
      "director": "James Cameron",
      "year": 1991
    }
    ```

    Now you have a structured JSON response from the model, which can be used in your application.
  </Step>
</Steps>

## Understanding Strict Mode

Strict mode guarantees that the model's output will exactly match the JSON schema you provide. When `strict` is set to `true`, Cerebras employs constrained decoding to ensure schema conformance at the token level, making invalid outputs impossible.

### Why Use Strict Mode

Without strict mode, you may encounter:

* Malformed JSON that fails to parse
* Missing required fields
* Incorrect data types (e.g., `"16"` instead of `16`)
* Extra fields not defined in your schema

With strict model enabled, you get:

* *Guaranteed* valid JSON
* Schema compliance: Every field matches your specification
* Type safety: Correct data types for all properties
* No retries needed: Eliminates error handling for schema violations

### Enabling Strict Mode

Set `strict` to `true` in your `response_format` configuration:

```python  theme={null}
response_format={
    "type": "json_schema",
    "json_schema": {
        "name": "my_schema",
        "strict": True,  # Enable constrained decoding
        "schema": your_schema
    }
}
```

### Schema Requirements for Strict Mode

When using strict mode, you must set `additionalProperties: false`. This is required for every object in your schema.

### Limitations in Strict Mode

The following limitations apply if `strict` is set to `true` in the JSON schema:

<Accordion title="Schema Limitations">
  * Recursive JSON schemas are not currently supported.
  * Maximum schema length is limited to 5000 characters.
  * Maximum nesting depth is 10 levels.
  * Maximum number of object properties is 500.
  * A schema may have a maximum of 500 enum values across all enum properties.
  * For a single enum property with string values, the total string length of all enum values cannot exceed 7500 characters when there are more than 250 enum values.
</Accordion>

<Accordion title="Array Validation">
  * `items: true` is not supported for JSON schema array types.
  * `items: false` is supported when used with `prefixItems` for tuple-like arrays with validation rules.
</Accordion>

<Accordion title="Schema Structure">
  * `$anchor` keyword is not supported - use relative paths within definitions/references instead.
  * Use `$defs` instead of `definitions` for reusable schema components.
  * Additional informational fields meant as guidelines (not used in validation) are not supported.
</Accordion>

<Accordion title="Supported Reference Patterns">
  <Danger>
    For security reasons, external schema references are not supported.
  </Danger>

  * Internal definitions are supported: `"$ref": "#/$defs/cast_member"`
  * Other reference access patterns are not recommended, and will be deprecated in future releases. See [Schema References and Definitions](#schema-references-and-definitions) for more info.
</Accordion>

## Schema References and Definitions

You can use `$ref` with `$defs` to define reusable schema components within your JSON schema. This is useful for avoiding repetition and creating more maintainable schemas.

```python highlight={5,7-8} theme={null}
schema_with_defs = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "director": {"$ref": "#/$defs/person"},
        "year": {"type": "integer"},
        "lead_actor": {"$ref": "#/$defs/person"},
        "studio": {"$ref": "#/$defs/studio"}
    },
    "required": ["title", "director", "year"],
    "additionalProperties": False,
    "$defs": {
        "person": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "age": {"type": "integer"}
            },
            "required": ["name"],
            "additionalProperties": False
        },
        "studio": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "founded": {"type": "integer"},
                "headquarters": {"type": "string"}
            },
            "required": ["name"],
            "additionalProperties": False
        }
    }
}
```

## Advanced Schema Features

Your schema can include various JSON Schema features:

* **Fundamental Data Types**: String, Number, Boolean, Integer, Object, Array, Enum, null.
* **Union Types**: Use `anyOf` to allow the model to return one of multiple possible types (max of 5).
* **Nested structures**: Define complex objects with nested properties, with support for up to 5 layers of nesting. You can also use definitions to reference reusable schema components.
* **Required fields**: Specify which fields must be present.
* **Additional properties**: Control whether extra fields are allowed. Note: the only accepted value is `false`. For every `required` array you define in your schema, you must set `additionalProperties` to `false`.
* **Enums (value constraints)**: Use the `enum` keyword to whitelist the exact literals a field may take. See `rating` in the example below.

For example, a more complex schema might look like:

```python  theme={null}
detailed_schema = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "director": {"type": "string"},
        "year": {"type": "integer"},
        "genres": {
            "type": "array",
            "items": {"type": "string"}
        },
        "rating": {
            "type": "string",
            "enum": ["G", "PG", "PG‑13", "R"]
        },
        "cast": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "role": {"type": "string"}
                },
                "required": ["name"],
                "additionalProperties": False
            }
        }
    },
    "required": ["title", "director", "year", "genres"],
    "additionalProperties": False
}
```

When used with the API, you might get a response like:

```json  theme={null}
{
  "title": "Jurassic Park",
  "director": "Steven Spielberg",
  "year": 1993,
  "genres": ["Science Fiction", "Adventure", "Thriller"],
  "cast": [
    {"name": "Sam Neill", "role": "Dr. Alan Grant"},
    {"name": "Laura Dern", "role": "Dr. Ellie Sattler"},
    {"name": "Jeff Goldblum", "role": "Dr. Ian Malcolm"}
  ]
}
```

## Working with Pydantic and Zod

Besides defining a JSON schema manually, you can use Pydantic (Python) or Zod (JavaScript) to create your schema and convert it to JSON. Pydantic's `model_json_schema` and Zod's `zodToJsonSchema` methods generate the JSON schema, which can then be used in the API call, as demonstrated in the workflow above.

<CodeGroup>

  ```javascript Node.js (Zod) theme={null}
  import { z } from 'zod';
  import { zodToJsonSchema } from 'zod-to-json-schema';

  // Define your schema using Zod
  const MovieSchema = z.object({
    title: z.string(),
    director: z.string(),
    year: z.number().int()
  });

  // Convert the Zod schema to a JSON schema
  const movieJsonSchema = zodToJsonSchema(MovieSchema, { name: 'movie_schema' });

  // Print the JSON schema to verify it
  console.log(JSON.stringify(movieJsonSchema, null, 2));
  ```
</CodeGroup>

## JSON Mode

In addition to structured outputs, you can also use JSON mode to generate JSON responses from the model. This approach tells the model to return data in JSON format but doesn't enforce a specific structure. The model decides what fields to include based on the context of your prompt.

<Note>
  We recommend using structured outputs with `strict` set to `true` whenever possible, as it provides more predictable and reliable results.
</Note>

To use JSON mode, set the `response_format` parameter to `json_object`:

<CodeGroup>

  ```javascript Node.js theme={null}
  async function main() {
    const jsonModeCompletion = await client.chat.completions.create({
      model: 'gpt-oss-120b',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that generates movie recommendations.' },
        { role: 'user', content: 'Suggest a sci-fi movie from the 1990s' }  
      ],
      response_format: {
        type: 'json_object'
      }
    }); 
  }
  ```
</CodeGroup>

### Limitations

* You must explicitly instruct the model to generate JSON through a system or user message.

### Structured Outputs vs JSON Mode

The table below summarizes the key differences between Structured Outputs and JSON Mode:

| Feature              | Structured Outputs (strict)                                                              | Structured Outputs (non-strict)                                                            | JSON Mode                                  |
| -------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------ |
| Outputs valid JSON   | Yes                                                                                      | Yes (best-effort)                                                                          | Yes                                        |
| Adheres to schema    | Yes (guaranteed)                                                                         | Yes                                                                                        | No (flexible)                              |
| Extra fields allowed | No                                                                                       | Yes                                                                                        | No (flexible)                              |
| Constrained Decoding | Yes                                                                                      | No                                                                                         | No                                         |
| Enabling             | `response_format: { type: "json_schema", json_schema: {"strict": true, "schema": ...} }` | `response_format: { type: "json_schema", json_schema: {"strict": false, "schema": ...} }`. | `response_format: { type: "json_object" }` |

<Warning>
  `tools` and `response_format` cannot be used in the same request.
</Warning>

## Conclusion

Structured outputs with JSON schema enforcement ensures your AI-generated responses follow a consistent, predictable format. This makes it easier to build reliable applications that can process AI outputs programmatically without worrying about unexpected data structures or missing fields.


# Tool Calling

> Learn how to connect models to external tools with tool calling.

Tool calling (also known as tool use or function calling) enables models to interact with external tools, applications, or APIs to perform various actions and access real-time information beyond their initial training data.

## How It Works

1. **Define the tool**: Provide a name, description, and input parameters for each tool you want the model to access.

2. **Send the request**: The prompt is sent along with available tool definitions in your API call.

3. **Model decides**: The model analyzes the prompt and its available tools to decide if a tool can help answer the question. If it decides to use a tool, it responds with a structured output indicating which tool to call and what arguments to use.

4. **Execute the tool**: The client application receives the model's tool call request, executes the specified tool (such as calling an external API), and retrieves the result.

5. **Generate final response**: The result from the tool is sent back to the model, which can then use this new information to generate a final, accurate response to the user.

## Basic Tool Calling

<Steps>
  <Step title="Initial Setup">
    To begin, we need to import the necessary libraries and set up our Cerebras client.

    <Tip>
      If you haven't set up your Cerebras API key yet, please visit our [QuickStart guide](/quickstart) for detailed instructions on how to obtain and configure your API key.
    </Tip>

    ```python  theme={null}
    import os
    import json
    import re
    from cerebras.cloud.sdk import Cerebras

    # Initialize Cerebras client
    client = Cerebras(
        api_key=os.environ.get("CEREBRAS_API_KEY"),
    )
    ```
  </Step>

  <Step title="Setting Up the Tool">
    Our first step is to define the tool that our AI will use. In this example, we're creating a simple calculator function that can perform basic arithmetic operations.

    ```python  theme={null}
    def calculate(expression):
        expression = re.sub(r'[^0-9+\-*/().]', '', expression)
        
        try:
            result = eval(expression)
            return str(result)
        except (SyntaxError, ZeroDivisionError, NameError, TypeError, OverflowError):
            return "Error: Invalid expression"
    ```
  </Step>

  <Step title="Defining the Tool Schema">
    Next, we define the tool schema. This schema acts as a blueprint for the AI, describing the tool's functionality, when to use it, and what parameters it expects. It helps the AI understand how to interact with our custom tool effectively.

    <Note>
      With `strict: true` enabled, tool call arguments are guaranteed to match your schema exactly through constrained decoding.
    </Note>

    ```python  theme={null}
    tools = [
        {
            "type": "function",
            "function": {
                "name": "calculate",
                "strict": True,
                "description": "A calculator tool that can perform basic arithmetic operations. Use this when you need to compute mathematical expressions or solve numerical problems.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "expression": {
                            "type": "string",
                            "description": "The mathematical expression to evaluate"
                        }
                    },
                    "required": ["expression"],
                    "additionalProperties": False
                }
            }
        }
    ]
    ```
  </Step>

  <Step title="Making the API Call">
    With our tool and its schema defined, we can now set up the conversation for our AI. We will prompt the LLM using natural language to conduct a simple calculation, and make the API call.

    This call sends our messages and tool schema to the LLM, allowing it to generate a response that may include tool use.

    ```python  theme={null}
    messages = [
        {"role": "system", "content": "You are a helpful assistant with access to a calculator. Use the calculator tool to compute mathematical expressions when needed."},
        {"role": "user", "content": "What's the result of 15 multiplied by 7?"},
    ]

    response = client.chat.completions.create(
        model="gpt-oss-120b",
        messages=messages,
        tools=tools,
        parallel_tool_calls=False,
    )
    ```
  </Step>

  <Step title="Handling Tool Calls">
    Now that we've made the API call, we need to process the response and handle any tool calls the LLM might have made. Note that the LLM determines based on the prompt if it should rely on a tool to respond to the user. Therefore, we need to check for any tool calls and handle them appropriately.

    In the code below, we first check if there are any tool calls in the model's response. If a tool call is present, we proceed to execute it and ensure that the function is fulfilled correctly. The function call is logged to indicate that the model is requesting a tool call, and the result of the tool call is logged to clarify that this is not the model's final output but rather the result of fulfilling its request. The result is then passed back to the model so it can continue generating a final response.

    ```python  theme={null}
    choice = response.choices[0].message

    if choice.tool_calls:
        function_call = choice.tool_calls[0].function
        if function_call.name == "calculate":
            # Logging that the model is executing a function named "calculate".
            print(f"Model executing function '{function_call.name}' with arguments {function_call.arguments}")

            # Parse the arguments from JSON format and perform the requested calculation.
            arguments = json.loads(function_call.arguments)
            result = calculate(arguments["expression"])

            # Note: This is the result of executing the model's request (the tool call), not the model's own output.
            print(f"Calculation result sent to model: {result}")
           
           # Send the result back to the model to fulfill the request.
            messages.append({
                "role": "tool",
                "content": json.dumps(result),
                "tool_call_id": choice.tool_calls[0].id
            })
     
           # Request the final response from the model, now that it has the calculation result.
            final_response = client.chat.completions.create(
                model="gpt-oss-120b",
                messages=messages,
            )
            
            # Handle and display the model's final response.
            if final_response:
                print("Final model output:", final_response.choices[0].message.content)
            else:
                print("No final response received")
    else:
        # Handle cases where the model's response does not include expected tool calls.
        print("Unexpected response from the model")
    ```
  </Step>
</Steps>

In this case, the LLM determined that a tool call was appropriate to answer the users' question of what the result of 15 multiplied by 7 is. See the output below.

```
Model executing function 'calculate' with arguments {"expression": "15 * 7"}
Calculation result sent to model: 105
Final model output: 15 * 7 = 105
```

## Strict Mode for Tool Calling

Strict mode ensures that the model generates tool call arguments that exactly match your defined schema. This is essential for building reliable agentic workflows where invalid parameters could break your application.

### Why Strict Mode Matters for Tools

Without strict mode, tool calls might include:

* Wrong parameter types (e.g., `"2"` instead of `2`)
* Missing required parameters
* Unexpected extra parameters
* Malformed argument JSON

With strict mode, you get guaranteed schema compliance for every tool call.

### Enabling Strict Mode

Set `strict` to `true` inside the `function` object of your tool definition:

```python Python theme={null}
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "strict": True,  # Enable constrained decoding
            "description": "Get the current weather for a location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "City and country, e.g., 'San Francisco, USA'"
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"]
                    }
                },
                "required": ["location", "unit"],
                "additionalProperties": False
            }
        }
    }
]
```

### Schema Requirements

When using strict mode, you must set `additionalProperties: false`. This is required for every object in your schema.

For information about schema limitations that apply when using strict mode, see [Limitations in Strict Mode](/capabilities/structured-outputs#limitations-in-strict-mode).

### Strict Mode with Parallel Tool Calling

Strict mode works with parallel tool calling. When multiple tools are called simultaneously, each tool call's arguments will conform to its respective schema:

```python Python theme={null}
response = client.chat.completions.create(
    model="zai-glm-4.7",
    messages=messages,
    tools=tools,  # Each tool can have strict: true
    parallel_tool_calls=True,
)
```

## Multi-turn Tool Calling

Most real-world workflows require more than one tool invocation. Multi-turn tool calling lets a model call a tool, incorporate its output, and then, within the same conversation, decide whether it needs to call the tool (or another tool) again to finish the task.

It works as follows:

1. After every tool call you append the tool response to `messages`, then ask the model to continue.
2. The model itself decides when enough information has been gathered to produce a final answer.
3. Continue calling `client.chat.completions.create()` until you get a message without `tool_calls`.

The example below demonstrates multi-turn tool calling as an extension of the calculator example above. Before continuing, make sure you’ve completed Steps 1–3 from the calculator setup section.

```python  theme={null}
messages = [
    {
        "role": "system",
        "content": (
            "You are a helpful assistant with a calculator tool. "
            "Use it whenever math is required."
        ),
    },
    {"role": "user", "content": "First, multiply 15 by 7. Then take that result, add 20, and divide the total by 2. What's the final number?"},
]

# Register every callable tool once
available_functions = {
    "calculate": calculate,
}

while True:
    resp = client.chat.completions.create(
        model="qwen-3-32b",
        messages=messages,
        tools=tools,
    )
    msg = resp.choices[0].message

    # If the assistant didn’t ask for a tool, we’re done
    if not msg.tool_calls:
        print("Assistant:", msg.content)
        break

    # Save the assistant turn exactly as returned
    messages.append(msg.model_dump())    

    # Run the requested tool
    call  = msg.tool_calls[0]
    fname = call.function.name

    if fname not in available_functions:
        raise ValueError(f"Unknown tool requested: {fname!r}")

    args_dict = json.loads(call.function.arguments)  # assumes JSON object
    output = available_functions[fname](**args_dict)

    # Feed the tool result back
    messages.append({
        "role": "tool",
        "tool_call_id": call.id,
        "content": json.dumps(output),
    })
```

## Parallel Tool Calling

Parallel tool calling allows models to call multiple tools simultaneously for reduced latency and faster responses.

For example, if a user asks "Is Toronto warmer than Montreal?", the model needs to check the weather in both cities. Rather than making two separate requests, parallel tool calling enables the model to request both operations at once, reducing latency and improving efficiency.

Parallel tool calling is most beneficial when:

* A single query requires multiple independent data points (e.g., comparing weather in different cities)
* Multiple tools need to be invoked that don't have dependencies on each other
* You want to reduce the number of API calls and overall response time

### Enable Parallel Tool Calling

You can explicitly control this behavior using the `parallel_tool_calls` parameter:

```python highlight={5} theme={null}
response = client.chat.completions.create(
    model="zai-glm-4.7",
    messages=messages,
    tools=tools,
    parallel_tool_calls=True,  # Enable parallel calling (default)
)
```

To disable parallel tool calling and force sequential execution:

```python highlight={5} theme={null}
response = client.chat.completions.create(
    model="zai-glm-4.7",
    messages=messages,
    tools=tools,
    parallel_tool_calls=False,  # Disable parallel calling
)
```

### Example: Weather Comparison

Let's walk through a complete example that demonstrates parallel tool calling by comparing weather in two cities.

<Steps>
  <Step title="Define the Weather Tool">
    First, we'll create a simple weather function and define the tool in our schema:

    ```python  theme={null}
    import os
    import json
    from cerebras.cloud.sdk import Cerebras

    client = Cerebras(
        api_key=os.environ.get("CEREBRAS_API_KEY"),
    )

    def get_weather(location):
        """
        Dummy function that returns mock weather data.
        In production, this would call a real weather API.
        """
        weather_data = {
            "location": location,
            "temperature": 22,
            "condition": "sunny",
            "humidity": 45,
        }
        return json.dumps(weather_data)

    tools = [
        {
            "type": "function",
            "function": {
                "name": "get_weather",
                "strict": True,
                "description": "Get temperature for a given location.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {
                            "type": "string",
                            "description": "City and country e.g. Toronto, Canada"
                        }
                    },
                    "required": ["location"],
                    "additionalProperties": False
                }
            }
        }
    ]
    ```
  </Step>

  <Step title="Make the API Call with Parallel Tool Calling Enabled">
    Now we'll send a query that requires checking weather in two different cities:

    ```python  theme={null}
    messages = [
        {
            "role": "system",
            "content": "You are a helpful Cerebras Assistant."
        },
        {
            "role": "user",
            "content": "Is Toronto warmer than Montreal?"
        }
    ]

    response = client.chat.completions.create(
        model="zai-glm-4.7",
        messages=messages,
        tools=tools,
        parallel_tool_calls=True,
    )
    ```
  </Step>

  <Step title="Handle Multiple Tool Calls">
    When parallel tool calling is enabled, the model's response may contain multiple tool calls in the `tool_calls` array. We need to iterate through all of them:

    ```python  theme={null}
    choice = response.choices[0].message

    if choice.tool_calls:
        # Add the assistant message with tool_calls first
        messages.append(choice)

        # Process all tool calls
        for tool_call in choice.tool_calls:
            function_call = tool_call.function
            print(f"Model executing function '{function_call.name}' with arguments {function_call.arguments}")
            
            # Parse arguments and execute the function
            arguments = json.loads(function_call.arguments)
            result = get_weather(arguments["location"])
            
            print(f"Weather data sent to model: {result}")
            
            # Append each tool result to messages
            messages.append({
                "role": "tool",
                "content": result,
                "tool_call_id": tool_call.id
            })
        
        # Get final response after all tool calls are processed
        final_response = client.chat.completions.create(
            model="zai-glm-4.7",
            messages=messages,
        )
        
        if final_response:
            print("Final model output:", final_response.choices[0].message.content)
        else:
            print("No final response received")
    else:
        print("No tool calls in response")
    ```
  </Step>
</Steps>

# Prompt Caching

> Store and reuse previously processed prompts to reduce latency and increase response times for similar or repeated queries.

This feature is designed to significantly reduce Time to First Token (TTFT) and improve responsiveness for long-context workloads, such as multi-turn conversations, RAG (Retrieval Augmented Generation), and agentic workflows.

## How It Works

Unlike other providers that require manual cache breakpoints or header modifications, Cerebras Prompt Caching works automatically on all supported API requests. No code changes are required.

1. **Prefix Matching**: When you send a request, the system analyzes the beginning of your prompt (the prefix). This includes system prompts, tool definitions, and few-shot examples.

2. **Block-Based Caching**: The system processes prompts in blocks (typically 100–600 tokens). If a block matches a segment stored in our ephemeral memory from a recent request within your organization, the computation is reused.

3. **Cache Hit**: Reusing cached blocks skips the processing phase for those tokens, resulting in lower latency.

4. **Cache Miss**: If no match is found, the prompt is processed as normal, and the prefix is stored in the cache for potential future matches.

5. **Automatic Expiration**: Cached data is ephemeral. We guarantee a Time-To-Live (TTL) of 5 minutes, though caches may persist up to 1 hour depending on system load.

<Note>
  To get a cache hit, the entire beginning of your prompt must match *exactly* with a previously cached prefix. Even a single character difference in the first token will result in a cache miss for that block and all subsequent blocks.
</Note>

## Example: Multi-Turn Conversation with Tool Calling

In this scenario, a shopping assistant helps users check order status and cancel orders using two tools: `get_order_status` and `cancel_order`. The system message and tool definitions remain constant across turns and are cached, while the conversation progresses naturally.

<CodeGroup>

  ```javascript Node.js expandable theme={null}
  import Cerebras from '@cerebras/cerebras_cloud_sdk';

  const client = new Cerebras({ apiKey: process.env.CEREBRAS_API_KEY });

  // Mock order database
  const ORDERS = {
    'ORD-123456': { status: 'processing', eta_days: 5 }
  };

  const getOrderStatus = (order_id) => {
    const order = ORDERS[order_id];
    if (!order) return { error: 'Order not found' };
    return { order_id, status: order.status, eta_days: order.eta_days };
  };

  const cancelOrder = (order_id) => {
    const order = ORDERS[order_id];
    if (!order) return { error: 'Order not found' };
    if (['shipped', 'delivered'].includes(order.status)) {
      return { error: `Cannot cancel - order already ${order.status}` };
    }
    order.status = 'cancelled';
    delete order.eta_days;
    return { order_id, status: 'cancelled' };
  };

  const tools = [
    {
      type: 'function',
      function: {
        name: 'get_order_status',
        description: 'Look up an order status by order ID',
        parameters: {
          type: 'object',
          properties: {
            order_id: { type: 'string', description: 'Order ID (e.g., ORD-123456)' }
          },
          required: ['order_id']
        },
        strict: true
      }
    },
    {
      type: 'function',
      function: {
        name: 'cancel_order',
        description: 'Cancel an order by order ID',
        parameters: {
          type: 'object',
          properties: {
            order_id: { type: 'string', description: 'Order ID (e.g., ORD-123456)' }
          },
          required: ['order_id']
        },
        strict: true
      }
    }
  ];

  // Helper function to handle tool calls in a more reusable way
  async function handleToolCalls(toolCalls, messages) {
    for (const call of toolCalls) {
      const args = JSON.parse(call.function.arguments);
      const orderId = args.order_id;
      
      let result;
      if (call.function.name === 'get_order_status') {
        result = getOrderStatus(orderId);
      } else if (call.function.name === 'cancel_order') {
        result = cancelOrder(orderId);
      }
      
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  async function run() {
    const messages = [
      { role: 'system', content: 'You are a shopping assistant. Help users check order status and cancel orders.' },
      { role: 'user', content: 'Where is my order ORD-123456?' }
    ];

    // Turn 1 - creates cache
    let response = await client.chat.completions.create({ model: 'qwen-3-32b', messages, tools });
    console.log('Turn 1 usage:', response.usage);

    let msg = response.choices[0].message;
    messages.push(msg);

    if (msg.tool_calls) {
      await handleToolCalls(msg.tool_calls, messages);
      
      response = await client.chat.completions.create({ model: 'qwen-3-32b', messages, tools });
      messages.push(response.choices[0].message);
      console.log('Turn 1 response:', response.choices[0].message.content);
    }

    // Turn 2 - uses cache
    messages.push({ role: 'user', content: 'Please cancel it, I ordered by mistake.' });
    response = await client.chat.completions.create({ model: 'qwen-3-32b', messages, tools });
    console.log('Turn 2 usage:', response.usage);

    msg = response.choices[0].message;
    messages.push(msg);

    if (msg.tool_calls) {
      await handleToolCalls(msg.tool_calls, messages);
      
      response = await client.chat.completions.create({ model: 'qwen-3-32b', messages, tools });
      console.log('Turn 2 response:', response.choices[0].message.content);
    }
  }

  run().catch(console.error);
  ```

  ```bash cURL expandable theme={null}
  #!/bin/bash

  API_KEY="${CEREBRAS_API_KEY}"
  BASE_URL="https://api.cerebras.ai/v1"

  if [ -z "$API_KEY" ]; then
      echo "Error: CEREBRAS_API_KEY environment variable is not set"
      exit 1
  fi

  TOOLS='[
    {
      "type": "function",
      "function": {
        "name": "get_order_status",
        "description": "Look up an order status by order ID",
        "parameters": {
          "type": "object",
          "properties": {
            "order_id": {"type": "string", "description": "Order ID (e.g., ORD-123456)"}
          },
          "required": ["order_id"]
        },
        "strict": true
      }
    },
    {
      "type": "function",
      "function": {
        "name": "cancel_order",
        "description": "Cancel an order by order ID",
        "parameters": {
          "type": "object",
          "properties": {
            "order_id": {"type": "string", "description": "Order ID (e.g., ORD-123456)"}
          },
          "required": ["order_id"]
        },
        "strict": true
      }
    }
  ]'

  SYSTEM="You are a shopping assistant. Help users check order status and cancel orders."

  echo "=== Turn 1 (Creates Cache) ==="

  curl -s -X POST "$BASE_URL/chat/completions" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg sys "$SYSTEM" --argjson tools "$TOOLS" '{
      model: "qwen-3-32b",
      messages: [{role: "system", content: $sys}, {role: "user", content: "Where is my order ORD-123456?"}],
      tools: $tools
    }')" | jq '{content: .choices[0].message.content, usage: .usage}'

  echo ""
  echo "=== Turn 2 (Uses Cache) ==="

  curl -s -X POST "$BASE_URL/chat/completions" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg sys "$SYSTEM" --argjson tools "$TOOLS" '{
      model: "qwen-3-32b",
      messages: [
        {role: "system", content: $sys},
        {role: "user", content: "Where is my order ORD-123456?"},
        {role: "assistant", content: "Your order ORD-123456 is currently processing with an estimated delivery in 5 days."},
        {role: "user", content: "Please cancel it, I ordered by mistake."}
      ],
      tools: $tools
    }')" | jq '{content: .choices[0].message.content, usage: .usage}'
  ```
</CodeGroup>

During each turn, the system automatically caches the longest matching prefix from previous requests. In this example:

* **System message**: The shopping assistant instructions remain identical across all turns
* **Tool definitions**: Both order management tool schemas (including parameters and descriptions) stay constant
* **Conversation history**: Previous user messages, assistant responses, and tool results are all cached as the conversation grows

Only the new content at the end of each request requires fresh processing:

* New user messages (the latest question)
* New tool execution results
* The model's reasoning and decision-making for the current turn

As the conversation grows, the cache hit rate increases dramatically. The static prefix (system + tools) remains cached, and the expanding conversation history also gets cached, meaning only the newest user message and the model's fresh response require full processing.

## Structuring Prompts for Caching

To maximize cache hits and minimize latency, organize your prompts with static content first and dynamic content last.

The system caches prompts from the **beginning** of the message. If you place dynamic content (like a timestamp or a unique User ID) at the start of the prompt, the prefix will differ for every request and the cache will never be triggered.

<Steps>
  <Step title="Static Content First">
    Place content that remains the same across multiple requests at the beginning:

    * System instructions ("You are a helpful assistant...")
    * Tool definitions and schemas
    * Few-shot examples
    * Large context documents (e.g., a legal agreement or code base)
  </Step>

  <Step title="Dynamic Content Last">
    Place content that changes with each request at the end:

    * User-specific questions
    * Session variables
    * Timestamps
  </Step>
</Steps>

<Tabs>
  <Tab title="Optimized (Cache Hit)">
    The "You are a coding assistant..." instruction block remains static and can be cached in subsequent requests. Only the short timestamp and user query are processed fresh.

    ```json  theme={null}
    [
      {
        "role": "system",
        "content": "You are a coding assistant... Current Time: 12:01 PM"
      },
      {
        "role": "user",
        "content": "Debug this code."
      }
    ]
    ```

    <Check>
      **Result:** The static portion of the system prompt is cached. Subsequent requests reuse the cache and only process the timestamp and user query.
    </Check>
  </Tab>

  <Tab title="Inefficient (Cache Miss)">
    In this example, the time is included at the start of the system instructions. Because the time changes every minute, the prefix never matches. Subsequent requests will always be fully processed.

    ```json  theme={null}
    [
      {
        "role": "system",
        "content": "Current Time: 12:01 PM. You are a coding assistant..."
      },
      {
        "role": "user",
        "content": "Debug this code."
      }
    ]
    ```

    <Warning>
      **Result:** Cache miss on every request because the timestamp changes the prefix.
    </Warning>
  </Tab>
</Tabs>

## Track Cache Usage

Verify if your requests are hitting the cache by viewing the `cached_tokens` field within the [`usage.prompt_token_details`](/api-reference/chat-completions#param-prompt-tokens-details) response object. This indicates the number of prompt tokens that were found in the cache.

```json  theme={null}
"usage": {
  "prompt_tokens": 3000,
  "completion_tokens": 150,
  "total_tokens": 3150,
  "prompt_tokens_details": {
    "cached_tokens": 2800
  }
}
```

In this example, 2,800 of the 3,000 prompt tokens were served from the cache, resulting in significantly faster processing.

Additionally, log in to [cloud.cerebras.ai](https://cloud.cerebras.ai) and click **Analytics** to track your cache usage.

## FAQs

<AccordionGroup>
  <Accordion title="Do cached tokens count toward rate limits?">
    Yes. All cached tokens contribute to your standard Tokens Per Minute (TPM) rate limits.

    **Calculation:** `cached_tokens + input_tokens` (fresh) = Total TPM usage for that request.
  </Accordion>

  <Accordion title="How are cached tokens priced?">
    There is no additional fee for using prompt caching. Input tokens, whether served from the cache or processed fresh, are billed at the standard input token rate for the respective model.
  </Accordion>

  <Accordion title="I'm sending the same request but not seeing it being cached. Why is that?">
    There are three common reasons for a cache miss on identical requests:

    1. **Block Size:** We cache in "blocks" (typically 100-600 tokens). If a request or prefix is shorter than the minimum block size, it may not be cached.

    2. **Data Center Routing:** While we make a best effort to route you to the same data center, traffic profiles may occasionally route you to a different location where your cache does not exist.

    3. **TTL Expiration:** If requests are sent more than 5 minutes apart, the cache may have been evicted.
  </Accordion>

  <Accordion title="Is prompt caching enabled for all customers?">
    Yes, prompt caching is automatically enabled for all users for the supported models.
  </Accordion>

  <Accordion title="Which models support prompt caching?">
    Prompt caching is enabled by default for the following models:

    * [`zai-glm-4.7`](/models/zai-glm-47)
    * [`gpt-oss-120b`](/models/openai-oss)
    * [`qwen-3-235b-a22b-instruct-2507`](/models/qwen-3-235b-2507)
    * [`qwen-3-32b`](/models/qwen-3-32b)
    * [`llama-3.3-70b`](/models/llama-33-70b)
  </Accordion>

  <Accordion title="Is prompt caching secure?">
    Yes, it is fully ZDR-compliant. All cached context remains ephemeral in memory and never persisted. Cached tokens are stored in key-value stores colocated in the same data center as the model instance serving your traffic.
  </Accordion>

  <Accordion title="How is data privacy maintained for caches?">
    Prompt caches are never shared between organizations. Only members of your organization can benefit from caches created by identical prompts within your team.
  </Accordion>

  <Accordion title="Does prompt caching affect output quality or speed?">
    Caching only affects the input processing phase (how we read your prompt). The output generation phase remains exactly the same speed and quality. You will receive the same quality response, just with faster prompt processing.
  </Accordion>

  <Accordion title="Can I manually clear the cache?">
    No manual cache management is required or available. The system automatically manages cache eviction based on the TTL (5 minutes to 1 hour).
  </Accordion>

  <Accordion title="What are the TTL guarantees?">
    Guaranteed TTL is 5 minutes, but up to 1 hour max depending on system load.
  </Accordion>

  <Accordion title="How can I tell when caching is working?">
    Check the `usage.prompt_tokens_details.cached_tokens` field in your API response. When it's greater than 0, caching was used for that request.

    Additionally, log in to [cloud.cerebras.ai](https://cloud.cerebras.ai) and click **Analytics** to track your cache usage.
  </Accordion>
</AccordionGroup>

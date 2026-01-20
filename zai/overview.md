# Overview

<Info>
  Z.AI offers a variety of models and agents to meet the needs of different scenarios. Choosing the right model can help you complete tasks more efficiently.
</Info>


## Featured Models

<CardGroup cols={3}>
  <Card title="GLM-4.7" icon="book-open" href="/guides/llm/glm-4.7">
    New Flagship Model
    Open-Source SOTA Capabilities
  </Card>

  <Card title="GLM-4.6V" icon="eyes" href="/guides/vlm/glm-4.6v">
    128K Context Window with Native Function Call Support
  </Card>

  <Card title="GLM-Image" icon="image" href="/guides/image/glm-image">
    Supports text-to-image generation, achieving open-source state-of-the-art (SOTA) in complex scenarios
  </Card>
</CardGroup>

## Models, Agents and Tools

To help you find the best fit for your use case, we've created a table outlining the core features and strengths of each model in the Z.AI family.

<Tip>
  If you need to get pricing information, please go directly to [Pricing](/guides/overview/pricing).
</Tip>

### Text Models

Our model matrix includes text models with built-in reasoning capabilities, as well as vision-language models (VLMs) that extend the same reasoning power to multimodal understanding.

| Model                | Strength                                                                                     | Language          | Context | Resourse                                                                                                |
| :------------------- | :------------------------------------------------------------------------------------------- | :---------------- | :------ | :------------------------------------------------------------------------------------------------------ |
| GLM-4.7              | SOTA Performance<br />Enhanced General Capabilities<br />Optimized Agentic Coding            | English & Chinese | 200K    | [Guide](/guides/llm/glm-4.7)<br /><br />[API Reference](/api-reference/llm/chat-completion)             |
| GLM-4.7-FlashX       | Enhanced General Capabilities<br />Optimized Agentic Coding<br />Lightweight & High-Speed    | English & Chinese | 200K    | [Guide](/guides/llm/glm-4.7)<br /><br />[API Reference](/api-reference/llm/chat-completion)             |
| GLM-4.6              | High Performance<br />Strong Coding<br />More Versatile                                      | English & Chinese | 200K    | [Guide](/guides/llm/glm-4.6)<br /><br />[API Reference](/api-reference/llm/chat-completion)             |
| GLM-4.6V(vlm)        | Native Function Call Support<br />Thinking Mode Switch Support                               | English & Chinese | 128K    | [Guide](/guides/vlm/glm-4.6v)<br /><br />[API Reference](/api-reference/llm/chat-completion)            |
| GLM-4.6V-FlashX(vlm) | Native Function Call Support<br />Thinking Mode Switch Support<br />Lightweight & High-Speed | English & Chinese | 128K    | [Guide](/guides/vlm/glm-4.6v)<br /><br />[API Reference](/api-reference/llm/chat-completion)            |
| GLM-4.5              | Better Performance<br />Strong Reasoning<br />More Versatile                                 | English & Chinese | 128K    | [Guide](/guides/llm/glm-4.5)<br /><br />[API Reference](/api-reference/llm/chat-completion)             |
| GLM-4.5V(vlm)        | Multimodal<br />Flexible Reasoning                                                           | English & Chinese | 64K     | [Guide](/guides/vlm/glm-4.5v)<br /><br />[API Reference](/api-reference/llm/chat-completion)            |
| GLM-4.5-X            | Good Performance<br />Strong Reasoning<br />Ultra-Fast Response                              | English & Chinese | 128K    | [Guide](/guides/llm/glm-4.5)<br /><br />[API Reference](/api-reference/llm/chat-completion)             |
| GLM-4.5-Air          | Cost-Effective<br />Lightweight<br />High Performance                                        | English & Chinese | 128K    | [Guide](/guides/llm/glm-4.5)<br /><br />[API Reference](/api-reference/llm/chat-completion)             |
| GLM-4.5-AirX         | Lightweight<br />High Performance<br />Ultra-Fast Response                                   | English & Chinese | 128K    | [Guide](/guides/llm/glm-4.5)<br /><br />[API Reference](/api-reference/llm/chat-completion)             |
| GLM-4-32B-0414-128K  | High intelligence at <br />unmatched cost-efficiency                                         | English & Chinese | 128K    | [Guide](/guides/llm/glm-4-32b-0414-128k)<br /><br />[API Reference](/api-reference/llm/chat-completion) |
| GLM-4.7-Flash        | Free, Lightweight<br />High Performance                                                      | English & Chinese | 200K    | [Guide](/guides/llm/glm-4.7)<br /><br />[API Reference](/api-reference/llm/chat-completion)             |
| GLM-4.6V-Flash       | Free, Native Function Call Support                                                           | English & Chinese | 128K    | [Guide](/guides/vlm/glm-4.6v)<br /><br />[API Reference](/api-reference/llm/chat-completion)            |
| GLM-4.5-Flash        | Free, Lightweight<br />Strong Reasoning<br />                                                | English & Chinese | 200K    | [Guide](/guides/llm/glm-4.5)<br /><br />[API Reference](/api-reference/llm/chat-completion)             |

### Built-in Tools

A suite of built-in tools designed to streamline workflows and boost productivity.

| Tool       | Capability                                                                                                                    |
| :--------- | :---------------------------------------------------------------------------------------------------------------------------- |
| Web Search | - Provide real-time, concise, direct answers<br />- Accurately parse complex HTML and converts it into clean Markdown or JSON |

### Image Generation Models

Image Generation Models learn from massive image data to automatically generate high-quality images from text.

| Model     | Strength                                                                                                      | Language          | Resolution           | Resourse                                                                                         |
| :-------- | :------------------------------------------------------------------------------------------------------------ | :---------------- | :------------------- | :----------------------------------------------------------------------------------------------- |
| GLM-Image | - Stronger in complex instruction and knowledge-intensive scenarios<br />- Open-source SOTA in text rendering | English & Chinese | multiple resolutions | [Guide](/guides/image/glm-image)<br /><br />[API Reference](/api-reference/image/generate-image) |
| CogView-4 | - High-quality image generation<br />- Diverse styles<br />- Rich in detail                                   | English & Chinese | multiple resolutions | [Guide](/guides/image/cogview-4)<br /><br />[API Reference](/api-reference/image/generate-image) |

### Video Generation Models

Video Generation Models turn text, images, or clips into dynamic video content, accelerating creativity for film, virtual avatars, animation, and marketing.

| Model       | Strength                                                                              | Language          | Resolution           | Resourse                                                                                              |
| :---------- | :------------------------------------------------------------------------------------ | :---------------- | :------------------- | :---------------------------------------------------------------------------------------------------- |
| CogVideoX-3 | Significant improvements in image quality, stability, and physical realism simulation | English & Chinese | multiple resolutions | [Guide](/guides/video/cogvideox-3)<br /><br />[API Reference](/api-reference/video/cogvideox-3\&vidu) |
| ViduQ1      | Theatrical quality with seamless temporal flow                                        | English & Chinese | 1080P                | [Guide](/guides/video/vidu-q1)<br /><br />[API Reference](/api-reference/video/cogvideox-3\&vidu)     |
| Vidu2       | Fast delivery with smart style preservation                                           | English & Chinese | 720P                 | [Guide](/guides/video/vidu2)<br /><br />[API Reference](/api-reference/video/cogvideox-3\&vidu)       |

### Audio Models

Audio models are a class of multimodal models that process audio and video signals, enabling the understanding, generation, or editing of audiovisual content.

| Model        | Strength                                                                                                                  | Multimodal Support | Resourse                                                                                                  |
| :----------- | :------------------------------------------------------------------------------------------------------------------------ | :----------------- | :-------------------------------------------------------------------------------------------------------- |
| GLM-ASR-2512 | - CER as low as 0.0717<br />- Support user-defined vocabularies<br />- Support multiple mainstream languages and dialects | Audio              | [Guide](/guides/audio/glm-asr-2512)<br /><br />[API Reference](/api-reference/audio/audio-transcriptions) |

### Agents

A set of ready-made agents empower users to create and communicate effortlessly.

| Tool                                    | Capability                                                                 | Resource                      |
| :-------------------------------------- | :------------------------------------------------------------------------- | :---------------------------- |
| GLM Slide/Poster Agent(beta)            | Combine content generation with professional design                        | [Guide](/guides/agents/slide) |
| General-Purpose Translation             | Support 40+ languages, flexible strategies, and terminology customization  | [Guide](/guides/agents/slide) |
| Popular Special Effects Video Templates | Special effects video templates like French\_Kiss, BodyShake, and Sexy\_Me | [Guide](/guides/agents/slide) |


---
import { UnexpectedValueException } from '@rightcapital/exceptions';
import retry from 'async-retry';
import OpenAI from 'openai';
import { ImageSourceUrlHelpers } from '../helpers/image-source-url.helpers';
import { IParsedPromptParts } from '../helpers/prompt-parser.helpers';
import type { Message } from '../helpers/slack.helpers';

const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-3.5-turbo';
const OPENAI_CHAT_TEMPERATURE = parseInt(
  process.env.OPENAI_CHAT_TEMPERATURE || '0.6',
  10,
);

const OPENAI_ARTIST_CHAT_SYSTEM_PROMPT = `
You are a professional "prompt" generator for DALL·E.
DALL·E is an AI system that can create realistic images and art from a description in natural language. the description here is called "prompt".

Just produce the "prompt" directly by the user message and the conversation context. Please use English to describe the "prompt".

Consider I'am DALL·E. your response will be used by me directly to generate image. 

DO NOT say anything like:
"Sure! Here's the prompt text for DALL·E: ......"
just
"......"

`;

export class OpenAIService {
  private constructor(
    private client: OpenAI = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    }),
  ) {}

  public static instance: OpenAIService = new OpenAIService();

  public async openAIChatCompletion(options: {
    messages: OpenAI.Chat.ChatCompletionMessageParam[];
  }) {
    const { client } = this;

    return retry(
      async (_bait) => {
        const response = await client.chat.completions.create({
          model: OPENAI_CHAT_MODEL,
          temperature: OPENAI_CHAT_TEMPERATURE,
          messages: options.messages,
        });

        return response.choices[0];
      },
      {
        retries: 3,
      },
    );
  }

  public async createNewImageByPrompt(
    parsedPromptParts: IParsedPromptParts,
  ): Promise<(string | undefined)[]> {
    const openai = this.client;

    const incomingSourceUrlBuffers = await Promise.all(
      parsedPromptParts.urls.map((url) =>
        ImageSourceUrlHelpers.fetchImageFileByUrl(url),
      ),
    );

    // Default model is set to DALL-E 3
    let dalleModel: string = 'dall-e-3';

    // Fallback to DALL-E 2 only when the parameters we provided are not supported by 3
    if (
      parsedPromptParts.options.count > 1 ||
      ['256x256', '512x512'].includes(parsedPromptParts.options.size)
    ) {
      dalleModel = 'dall-e-2';
    }
    return retry(
      async (_bait) => {
        let response;
        if (parsedPromptParts.flags.isVariationFlagOn) {
          // Cast the ReadStream to `any` to appease the TypeScript compiler
          response = await openai.images.createVariation({
            image: incomingSourceUrlBuffers[0],
            n: parsedPromptParts.options.count,
            size: parsedPromptParts.options.size,
          });
        } else if (parsedPromptParts.flags.isEditFlagOn) {
          response = await openai.images.edit({
            image: incomingSourceUrlBuffers[0],
            prompt: parsedPromptParts.textPrompt,
            mask: parsedPromptParts.flags.isMaskFlagOn
              ? incomingSourceUrlBuffers[incomingSourceUrlBuffers.length - 1]
              : undefined,
            n: parsedPromptParts.options.count,
            size: parsedPromptParts.options.size,
          });
        } else {
          response = await openai.images.generate({
            model: dalleModel,
            prompt: parsedPromptParts.textPrompt,
            n: parsedPromptParts.options.count,
            size: parsedPromptParts.options.size,
          });
        }
        return response.data.map((responseData) => responseData.url);
      },
      {
        retries: 3,
      },
    );
  }

  public async getPromptByMessages(
    messages: Message[],
    botUserId: string | undefined,
  ): Promise<string> {
    const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    for (const message of messages) {
      const name = message.user;
      chatMessages.push({
        role: message.user === botUserId ? 'assistant' : 'user',
        content:
          message.user === botUserId
            ? message.text ?? null
            : `${name}:\n${message.text}`,
        name,
      });
    }

    if (OPENAI_CHAT_MODEL.startsWith('gpt-3.5-turbo')) {
      // GPT 3.5's system prompt doesn't work very well.
      chatMessages[chatMessages.length - 1].content =
        `${OPENAI_ARTIST_CHAT_SYSTEM_PROMPT}The following is the user message: ${chatMessages[
          chatMessages.length - 1
        ].content?.toString()}`;
    } else {
      chatMessages.unshift({
        role: 'system',
        content: OPENAI_ARTIST_CHAT_SYSTEM_PROMPT,
      });
    }

    const answer = await OpenAIService.instance.openAIChatCompletion({
      messages: chatMessages,
    });

    if (!answer.message.content) {
      throw new UnexpectedValueException(
        'ChatGPT cannot generate proper prompt for DALL-E',
      );
    }

    return answer.message.content;
  }
}

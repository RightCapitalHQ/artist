import { UnexpectedValueException } from '@rightcapital/exceptions';
import retry from 'async-retry';
import OpenAI from 'openai';
import { ImageSourceUrlHelpers } from '../helpers/image-source-url.helpers';
import { IParsedPromptParts } from '../helpers/prompt-parser.helpers';
import type { Message } from '../helpers/slack.helpers';

export class OpenAIService {
  private constructor(
    private client: OpenAI = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    }),
  ) {}

  public static instance: OpenAIService = new OpenAIService();

  public async openAIChatCompletion(options: {
    messages: OpenAI.Chat.ChatCompletionMessageParam[];
    temperature?: number;
  }) {
    const { client } = this;

    return retry(
      async (_bait) => {
        const response = await client.chat.completions.create({
          model: 'gpt-3.5-turbo',
          temperature: options.temperature || 0.6,
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

    chatMessages.push({
      role: 'system',
      content: `
You are now a DALLE-2 prompt generation tool that will generate a suitable prompt based on the message I sent you and the conversation's whole context.
please respond to me with the \`prompt\` directly. 
Don't ask me, I will not give you any more information.
`,
    });

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

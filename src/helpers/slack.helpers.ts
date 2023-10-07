import https from 'https';
import { FilesUploadResponse, WebClient } from '@slack/web-api';
import type { Message as ReplyMessage } from '@slack/web-api/dist/response/ConversationsRepliesResponse';
import { snakeCase } from 'lodash';
import { PromptParserHelpers } from './prompt-parser.helpers';
import { OpenAIService } from '../service/openai.service';

export type Message = ReplyMessage & { channel: string };

const enum SpecialSlashAnswer {
  Imagine = '/imagine ',
}

export class SlackHelpers {
  /**
   * Streaming the Public Image URL to Slack File Server,
   * to make it permanently accessible for Slack message
   *
   * @param client WebClient of the Slack instance
   * @param channelId the channel to upload the image to
   * @param threadTs the Thread to upload the image to
   * @param url the Image URL which needs to be uploaded to Slack File Server
   * @param prompt the prompt to gen the image
   * @returns Promise<FilesUploadResponse> the file upload result
   */
  public static async uploadImageToSlackFileServer(
    client: WebClient,
    channelId: string,
    threadTs: string | undefined,
    url: string,
    prompt: string,
  ): Promise<FilesUploadResponse> {
    return new Promise((resolve, reject) => {
      try {
        https.get(url, (incomingMessage) => {
          // we need to provide a explicit file name(with extension) to display the image correctly
          const result = client.files.uploadV2({
            // channels can be a list of one to many strings
            channels: channelId,
            // Include your filename in a ReadStream here
            file: incomingMessage,
            filename: `${snakeCase(prompt)}.png`,
            title: prompt,
            thread_ts: threadTs,
          });
          resolve(result);
        });
      } catch (exception) {
        reject(exception);
      }
    });
  }

  /**
   * Process Special answer if needed, such as generate Dall-E 2 image
   *
   * @param client WebClient of the Slack instance
   * @param answer the answer to process
   * @param channelId the channel ID for the answer replied to
   * @param threadTs the thread of the answer replied to
   */
  public static async preprocessSpecialAnswer(
    client: WebClient,
    answer: string,
    channelId: string,
    threadTs: string,
  ): Promise<void> {
    if (answer.startsWith(SpecialSlashAnswer.Imagine)) {
      const prompt = answer.replace(SpecialSlashAnswer.Imagine, '');
      const parsedPromptParts = PromptParserHelpers.parse(prompt);
      try {
        const generatedImageUrls =
          await OpenAIService.instance.createNewImageByPrompt(
            parsedPromptParts,
          );
        for await (const generatedImageUrl of generatedImageUrls) {
          if (generatedImageUrl) {
            await SlackHelpers.uploadImageToSlackFileServer(
              client,
              channelId,
              threadTs,
              generatedImageUrl,
              prompt,
            );
          }
        }
      } catch (e) {
        // Let superior function handle the error processing.
        throw new Error(
          'Failed to generate image by DALL·E or Upload image to Slack file server',
          { cause: e },
        );
      }
    }
  }

  public static async getConversationMessagesByEventMessage(
    client: WebClient,
    message: Message,
  ): Promise<Message[]> {
    if (message.thread_ts === undefined) {
      // A new thread
      return [
        {
          text: message.text,
          user: message.user,
          ts: message.ts,
          channel: message.channel,
        },
      ];
    }

    // a reply inside specific thread
    const messages: Message[] = [];
    const repliesResponse = await client.conversations.replies({
      channel: message.channel,
      ts: message.thread_ts,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      latest: message.ts! + 1,
    });

    for (const m of repliesResponse.messages || []) {
      messages.push({
        text: m.text,
        user: m.user,
        ts: m.ts,
        channel: message.channel,
      });
    }

    return messages;
  }
}

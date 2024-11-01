import https from 'node:https';

import type { FilesUploadResponse, WebClient } from '@slack/web-api';
import type { Message as ReplyMessage } from '@slack/web-api/dist/response/ConversationsRepliesResponse';
import { snakeCase } from 'lodash';

export type Message = ReplyMessage & { channel: string };

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
            filetype: 'png',
            title: prompt,
            thread_ts: threadTs,
          });
          resolve(result);
        });
      } catch (exception) {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        reject(exception);
      }
    });
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

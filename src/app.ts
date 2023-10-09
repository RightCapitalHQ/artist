import { App } from '@slack/bolt';
import {
  ChatPostMessageResponse,
  WebClient,
  WebAPIPlatformError,
  ErrorCode,
} from '@slack/web-api';
import { PromptParserHelpers } from './helpers/prompt-parser.helpers';
import { SlackHelpers } from './helpers/slack.helpers';
import { OpenAIService } from './service/openai.service';

if (
  !process.env.SLACK_BOT_TOKEN ||
  !process.env.SLACK_SIGNING_SECRET ||
  !process.env.SLACK_APP_TOKEN ||
  !process.env.OPENAI_API_KEY
) {
  // eslint-disable-next-line no-console
  console.log(
    'Please set required environment variables before starting this server',
  );
}

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

app.use(async ({ next }) => {
  await next();
});

// Use MidJourney style command `/imagine` https://docs.midjourney.com/docs/quick-start#3-use-the-imagine-command
app.command('/imagine', async ({ command, ack, say, client }) => {
  await ack({
    response_type: 'in_channel',
  });

  const prompt = command.text;

  const message = await say({
    text: 'Your image is being created by AI :wink:',
    channel: command.channel_id,
  });

  await generateReplyMessageByPrompt(
    client,
    prompt,
    command.channel_id,
    message,
    undefined,
  );
});

// subscribe to 'app_mention' event in your App config
// need app_mentions:read and chat:write scopes
app.event('app_mention', async ({ event, context, client, say }) => {
  const conversationMessages =
    await SlackHelpers.getConversationMessagesByEventMessage(client, {
      text: event.text,
      user: event.user,
      thread_ts: event?.thread_ts,
      channel: event.channel,
      ts: event.ts,
    });

  const prompt = await OpenAIService.instance.getPromptByMessages(
    conversationMessages,
    context.botUserId,
  );

  const reply = await say({
    text: 'Your image is being created by AI :wink:',
    thread_ts: event.ts,
  });

  await generateReplyMessageByPrompt(
    client,
    prompt,
    event.channel,
    reply,
    event.ts,
  );
});

async function generateReplyMessageByPrompt(
  client: WebClient,
  prompt: string,
  channelId: string,
  message: ChatPostMessageResponse,
  threadTs: string | undefined,
) {
  const parsedPromptParts = PromptParserHelpers.parse(prompt);

  try {
    const generatedImageUrls =
      await OpenAIService.instance.createNewImageByPrompt(parsedPromptParts);
    for await (const generatedImageUrl of generatedImageUrls) {
      if (generatedImageUrl)
        await SlackHelpers.uploadImageToSlackFileServer(
          client,
          channelId,
          threadTs,
          generatedImageUrl,
          prompt,
        );
    }

    if (message.channel && message.ts) {
      await client.chat.update({
        channel: message.channel,
        ts: message.ts,
        text: `Your masterpiece! 👇🏻`,
      });
    }
  } catch (exception) {
    if (message.channel && message.ts) {
      let errorMessage = 'Oh no! failed to generate image by DALL·E 2';
      if (
        (exception as WebAPIPlatformError).code === ErrorCode.PlatformError &&
        (exception as WebAPIPlatformError).data.error === 'not_in_channel'
      ) {
        errorMessage = `The image was generated successfully, but it cannot be uploaded to private channel, you need to \`\\invite <@${
          message.message?.user || ''
        }>\` to current channel first`;
      }
      await client.chat.update({
        channel: message.channel,
        ts: message.ts,
        text: errorMessage,
      });
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  // Start your app
  await app.start(Number(process.env.PORT) || 3000);

  // eslint-disable-next-line no-console
  console.log('⚡️ Artist app is running!');
})();

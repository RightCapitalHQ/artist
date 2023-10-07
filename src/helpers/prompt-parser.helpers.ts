import { cloneDeep } from 'lodash';
import { ImageSourceUrlHelpers } from './image-source-url.helpers';

export interface IParsedPromptParts {
  textPrompt: string;
  urls: string[];
  options: {
    size: '256x256' | '512x512' | '1024x1024';
    count: number;
  };
  flags: {
    isEditFlagOn: boolean;
    isMaskFlagOn: boolean;
    isVariationFlagOn: boolean;
  };
}

const EDIT_FLAGS = ['--edit', '-e'];
const MASK_FLAGS = ['--mask', '-m'];
const VARIATION_FLAGS = ['--variation', '-v'];
const SIZE_OPTIONS = ['--size', '-s'];
const COUNT_OPTIONS = ['--count', '-n'];

const defaultParsedPromptParts: IParsedPromptParts = {
  textPrompt: '',
  urls: [],
  options: {
    size: '512x512' as '256x256' | '512x512' | '1024x1024',
    count: 1,
  },
  flags: {
    isEditFlagOn: false,
    isMaskFlagOn: false,
    isVariationFlagOn: false,
  },
};

export class PromptParserHelpers {
  /**
   * Parse raw prompt text to structure object
   * the Input like : hello world --edit --mask --count 10 https://this.com/world.jpg --size 1024x1024
   * will parsed into object like:
   * {
   *  textPrompt: 'hello world',
   *  urls: [ 'https://this.com/world.jpg' ],
   *  options: { size: '1024x1024', count: 10 },
   *  flags: { isEditFlagOn: true, isMaskFlagOn: true }
   * }
   *
   * @param rawPrompt Raw Prompt text to parse
   * @returns the structure object to represent the prompt
   */
  public static parse(rawPrompt: string): IParsedPromptParts {
    const parsedPromptParts: IParsedPromptParts = cloneDeep(
      defaultParsedPromptParts,
    );

    // Split the raw prompt by " " space.
    const rawPromptParts = rawPrompt.split(' ');

    const textPromptParts: string[] = [];

    for (
      let currentIndex = 0;
      currentIndex < rawPromptParts.length;
      // eslint-disable-next-line no-plusplus
      currentIndex++
    ) {
      const currentPart = rawPromptParts[currentIndex];
      const hasNextPart = currentIndex < rawPromptParts.length - 1;
      if (EDIT_FLAGS.includes(currentPart)) {
        parsedPromptParts.flags.isEditFlagOn = true;
      } else if (MASK_FLAGS.includes(currentPart)) {
        parsedPromptParts.flags.isMaskFlagOn = true;
      } else if (VARIATION_FLAGS.includes(currentPart)) {
        parsedPromptParts.flags.isVariationFlagOn = true;
      } else if ([...SIZE_OPTIONS, ...COUNT_OPTIONS].includes(currentPart)) {
        if (hasNextPart) {
          const nextPart = rawPromptParts[currentIndex + 1];
          if (
            COUNT_OPTIONS.includes(currentPart) ||
            Number.isNaN(Number.parseInt(nextPart, 10))
          ) {
            parsedPromptParts.options.count = Number.parseInt(nextPart, 10);
            // eslint-disable-next-line no-plusplus
            currentIndex++;
          }
          if (SIZE_OPTIONS.includes(currentPart)) {
            // Only 3 sizes are valid
            if (['512x512', '1024x1024', '256x256'].includes(nextPart)) {
              parsedPromptParts.options.size = nextPart as
                | '256x256'
                | '512x512'
                | '1024x1024';
            }
            // eslint-disable-next-line no-plusplus
            currentIndex++;
          }
        }
      } else if (PromptParserHelpers.isSupportedUrl(currentPart)) {
        parsedPromptParts.urls.push(currentPart);
      } else {
        textPromptParts.push(currentPart);
      }
    }

    parsedPromptParts.textPrompt = textPromptParts.join(' ');

    return parsedPromptParts;
  }

  /**
   * Detect if this string is a supported URLs, currently
   * only https://pasteboard.co/ URL is supported
   *
   * @param possibleUrl URL to detect
   * @returns {boolean} true if we support that URL
   */
  private static isSupportedUrl(possibleUrl: string) {
    let url: URL;

    try {
      url = new URL(possibleUrl);
    } catch (_) {
      return false;
    }

    return (
      url.protocol === 'https:' &&
      ImageSourceUrlHelpers.isPasteboardUrl(possibleUrl)
    );
  }
}

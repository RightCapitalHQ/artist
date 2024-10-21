import { File } from 'node:buffer';
import type { BinaryLike } from 'node:crypto';

import { InvalidArgumentException } from '@rightcapital/exceptions';

export class ImageSourceUrlHelpers {
  public static isPasteboardUrl(possibleUrl: string): boolean {
    let url: URL;

    try {
      url = new URL(possibleUrl);
    } catch {
      return false;
    }
    return url.hostname === 'pasteboard.co';
  }

  public static async fetchImageFileByUrl(url: string): Promise<File> {
    const { imageUrl, refererUrl, imageFileName } =
      ImageSourceUrlHelpers.getImageUrlAndRefererBySourceUrl(url);

    const headers = {
      Referer: refererUrl,
    };
    const options = {
      headers,
    };
    const response = fetch(imageUrl, options);
    const responseArrayBuffer = await (await response).arrayBuffer();
    const imageFile = new File(
      [responseArrayBuffer as BinaryLike],
      imageFileName,
    );

    return imageFile;
  }

  public static getImageUrlAndRefererBySourceUrl(sourceUrl: string): {
    imageUrl: string;
    refererUrl: string;
    imageFileName: string;
  } {
    if (ImageSourceUrlHelpers.isPasteboardUrl(sourceUrl)) {
      const pasteboardShareUrl =
        /^https:\/\/pasteboard\.co\/(\w*.(png|jpg|jpeg|gif))$/;

      const matches = sourceUrl.match(pasteboardShareUrl);
      if (matches) {
        return {
          imageUrl: `https://gcdnb.pbrd.co/images/${matches[1]}?o=1`,
          refererUrl: sourceUrl,
          imageFileName: matches[1],
        };
      }

      return {
        imageUrl: sourceUrl,
        refererUrl: sourceUrl,
        imageFileName: new URL(sourceUrl).pathname,
      };
    }

    throw new InvalidArgumentException(
      `Unsupported source image provider URL: ${sourceUrl}`,
    );
  }
}

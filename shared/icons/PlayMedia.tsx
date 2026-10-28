import { createIcon } from "./createIcon";

const PlayMedia = createIcon(
  "PlayMedia",
  <>
    <g transform="translate(45 90) skewY(-6.5)" fill="currentColor">
      <path
        fillRule="evenodd"
        d="
          M22,0 H400 A22,22 0 0 1 422,22 V113 A22,22 0 0 1 400,135 H22 A22,22 0 0 1 0,113 V22 A22,22 0 0 1 22,0 Z
          M40,38 L115,38 L90,98 L40,98 Z
          M160,38 L243,38 L217,98 L135,98 Z
          M290,38 L382,38 L382,98 L265,98 Z
        "
      />
    </g>
    <path
      d="M85,210 V365 Q85,425 145,425 H367 Q427,425 427,365 V235"
      fill="none"
      stroke="currentColor"
      strokeWidth={40}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M222,288 L222,372 L308,328 Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={16}
      strokeLinejoin="round"
    />
  </>,
  "0 0 512 512"
);

export default PlayMedia;
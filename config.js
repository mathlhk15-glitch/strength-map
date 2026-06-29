/**
 * 우리 반 강점지도 - 설정 파일
 * Google Apps Script 배포 후 웹앱 URL을 아래에 붙여넣으세요.
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbz2F_P9z5LYp1p2gLZAdhc3pIfGurKkCFpqBC61OwsuS2AarGVCRXTgZS8BiYnnGs1w/exec";

// ===== 강점 목록 (정확히 2개 선택) =====
const STRENGTH_LIST = [
  "책임감", "성실함", "배려심", "경청",
  "끈기", "도전정신", "협력", "발표력",
  "리더십", "꼼꼼함", "침착함", "긍정적 태도",
  "문제해결력", "창의성", "분위기를 좋게 만드는 힘", "친구를 돕는 태도",
  "의견을 정리하는 능력", "약속을 잘 지키는 태도"
];

// ===== 이유 목록 (정확히 1개 선택) =====
const REASON_LIST = [
  "조별활동에서 맡은 일을 잘함",
  "친구 말을 잘 들어줌",
  "어려워하는 친구를 도와줌",
  "분위기를 밝게 만듦",
  "발표나 설명을 잘함",
  "약속을 잘 지킴",
  "끝까지 해보려는 모습이 있음",
  "의견을 잘 정리함",
  "친구들과 잘 협력함",
  "차분하고 침착함",
  "새로운 생각을 잘 냄",
  "실수해도 다시 해보려 함",
  "주변 사람을 편하게 해 줌"
];

// ===== 금칙어 필터 =====
const BANNED_WORDS = [
  "바보", "멍청", "못생", "뚱뚱", "찐따", "병신", "새끼", "꺼져",
  "극혐", "이상함", "의외로", "생각보다", "공부는 못하지만",
  "생긴 것과 다르게", "냄새", "돼지", "멸치", "치고는", "그래도"
];

// ===== 입력 길이 제한 =====
const LIMITS = {
  otherStrengthMin: 2,
  otherStrengthMax: 8,
  otherReasonMin: 10,
  otherReasonMax: 40,
  messageMin: 5,
  messageMax: 60
};

// ===== 반 목록 (1~9반, 필요시 직접 수정) =====
const CLASS_LIST = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

// ===== 번호 목록 (1~30번, 필요시 직접 수정) =====
const NUMBER_LIST = Array.from({ length: 30 }, (_, i) => String(i + 1));

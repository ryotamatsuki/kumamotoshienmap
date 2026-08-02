import { createElement } from "react";

export const metadata = {
  title: "令和8年熊本地震 支援・受援状況",
  description: "愛媛県の熊本地震支援を俯瞰する幹部・防災担当者向けダッシュボード",
};

export default function RootLayout({ children }) {
  return createElement(
    "html",
    { lang: "ja" },
    createElement("body", null, children),
  );
}

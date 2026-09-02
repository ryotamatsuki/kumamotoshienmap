# 熊本支援HP — 現行画面 → 改修後のデザイン方針

- Status: **DESIGN SPEC ONLY / 実装変更なし**
- Target: `index.html` / `ehime_kumamoto_support_geocoded_shelters_20260802.html` / sender coverage UI
- Reference: `ryotamatsuki/design-md-references`
- Primary style: `openai/DESIGN.md`
- Secondary style: `atlassian/DESIGN.md`
- Limited references: `linear/DESIGN.md`（操作部の密度・整列） / `perplexity/DESIGN.md`（根拠・出典の見せ方）

---

## 1. Design objective

現行の機能・データ・監査ロジックを維持したまま、見た目を **「高密度な業務ダッシュボード」から「自治体災害情報 × 現代的リサーチダッシュボード」へ** 移行する。

装飾を増やすのではなく、**タイポグラフィ、余白、情報階層、hairline、意味色**で整理する。災害情報サイトとして、視認性・可読性・根拠追跡性を最優先し、「おしゃれさ」はその結果として得る。

### Preserve

- 現行データ、CURRENT / PLANNED / HISTORICAL / UNKNOWN 等の裁定
- 地図、フィルタ、タブ、出典リンク、支援主体別表示
- 愛媛＝橙、市町村＝緑、国・関係機関＝青、被害＝赤という意味色
- PC / mobile の情報到達性
- Release Gate / post-deploy smoke で検証している既存機能

### Do not introduce

- 派手なgradient、glassmorphism、強いshadow
- ブランド模倣、ロゴ・固有アセットの転用
- 意味のない色分け
- 大量の装飾カード
- 小さい文字をさらに詰め込む高密度化

---

## 2. 現行 → 改修後

| 現行 | 改修後 |
|---|---|
| 薄いグレー背景＋多数の白カード | 白を主キャンバスにし、面ではなく余白とhairlineで区切る |
| ほぼ全要素が枠・radius・shadowを持つ | カードは重要KPI・独立操作・地図popupなど必要箇所だけに限定 |
| 9〜12px級の補助文字が多い | 本文13〜14px、主要補助11〜12pxを基本にし、9〜10pxは例外化 |
| KPI、状態、操作が同じ視覚強度 | 「現在状況 → KPI → 支援状況 → 詳細 → 出典」の順に視覚階層を固定 |
| 青系UI色が複数箇所で常用 | 基本は白・near-black・gray。青は主操作、既存の主体色は意味表示のみ |
| 角丸カードが連続する | section間は広い余白、内部は細い罫線。radiusは6〜10px中心 |
| hover・activeで背景色を広く使う | active stateのみ明確にし、通常controlはghost / outline中心 |
| 出典が詳細情報の末尾に埋もれやすい | 「確認時点・一次情報・更新状態」を独立したresearch metadataとして見せる |
| トップページが2カードの入口 | タイトル、目的、最終確認時点をhero化し、その下に主要導線を簡潔に配置 |

---

## 3. Target visual system

### Color

```text
Canvas             #FFFFFF
Primary ink        near-black (#111315 程度)
Muted text         neutral gray
Structural line    low-opacity black / neutral hairline
Soft surface       ごく薄い gray（必要箇所のみ）
Ehime              現行 orange を維持
Municipal          現行 green を維持
National           現行 blue を維持
Impact / warning   現行 red を維持
```

原則として、**通常UIに主体色を塗らない**。主体色はdot、bar、status marker、地図legend等の意味表示に限定する。

### Typography

- 日本語本文は OS標準sans stack を維持してよい
- ページタイトル: 28〜36px desktop / 22〜28px mobile
- セクションタイトル: 16〜20px
- 本文: 13〜14px
- metadata / source: 11〜12px
- weightは 400 / 500 / 600〜700 程度に整理し、`800+` の多用を避ける
- 行間を広めにし、太字ではなくサイズ・余白で階層をつくる

### Surface / border / elevation

- 基本shadow: none
- 浮遊要素（地図control / popup）だけsubtle shadow可
- border: 1px以下のhairline感
- radius: 6pxを標準、操作系8〜10px、pillはstatus / tab等に限定

---

## 4. Page anatomy

### A. Top page

```text
令和8年熊本地震
支援・受援状況
公式情報を時点・根拠とともに整理
最終確認 2026-09-02 16:16 JST
────────────────────────────
支援・受援状況        →
送出基礎自治体Coverage →
────────────────────────────
確認方針 / UNKNOWNを推測補完しない旨
```

「カード2枚」ではなく、**editorial landing page**として見せる。

### B. Main dashboard first view

最上段は「いま何が起きているか」を3秒で把握できる構成にする。

```text
令和8年熊本地震　支援・受援状況        最終確認 9/2 16:16
熊本県 第51報 / D+36

避難者 2,035    開設避難所 40    人的被害 404    住家被害 61,996
──────────────────────────────────────
Overview / Needs / Timeline / Support / Volunteer / Map
```

KPIの数字は大きく、説明は短くする。KPIカードを使う場合もshadowなし、同一baselineで整列する。

### C. Details / records

- record全体をカード化するのではなく、一覧はthin divider中心
- 状態、主体、対象地域、確認時点を先に表示
- 詳細を開いた後に根拠とURLを表示
- `CURRENT` 等のstatusは色面ではなく small pill / dot + text を基本とする

### D. Research metadata / sources

このサイトの差別化要素として、以下を視覚的に明確化する。

```text
STATUS       CURRENT
CONFIRMED    2026-09-02 14:00
SOURCE       熊本県災害対策本部 第51報
DEFINITION   現時点の公開一次情報で直接確認
```

「出典」は脚注扱いにせず、**情報の信頼性を構成するUI**として扱う。

---

## 5. Responsive policy

- mobileで横スクロール前提のKPI列を原則解消し、2列または縦stackへ
- headerはタイトル・更新時点・menuに絞る
- tap targetは44px程度を確保
- 本文11px未満を常用しない
- 地図利用時のみUI密度を上げ、通常ビューは読み物として自然な縦スクロールにする

---

## 6. Implementation order

1. **Tokens only** — color / type / spacing / border / radius / shadow をCSS変数へ集約
2. **Header + hero + KPI** — 第一印象と情報階層を変更
3. **Cards → divider/list** — 不要な囲みを削減
4. **Tabs / filters / status** — controlをghost / compact化
5. **Sources / metadata** — 根拠情報をresearch UI化
6. **Mobile** — 390px基準で再調整
7. **Map** — 最後に既存Leaflet UIとの調和を取る

機能・DOM・データ生成を一度に変更せず、**visual refactorを小さなPRに分割**する。

---

## 7. Acceptance criteria

改修後は以下を満たすこと。

- 3秒以内に「災害名・最新確認時点・主要KPI」が把握できる
- 通常画面でshadowと装飾カードへの依存が大幅に減っている
- 本文・主要metadataの可読性が現行以上
- 主体色・警告色の意味が現行から変わらない
- CURRENT / PLANNED / HISTORICAL / UNKNOWN の判別性を失わない
- 出典・確認時点への到達が容易になる
- 1440px desktop / 390px mobile で横方向のページoverflowがない
- 既存のRelease Gate、browser smoke、Pages post-deploy smokeがすべてPASS
- データ値・監査ロジック・更新フローに変更を生じさせない

**Design principle:** `OpenAI` の editorial minimalism を基準に、`Atlassian` の functional clarity を補助として採用する。`Linear` は操作部の精密さ、`Perplexity` はresearch metadataの見せ方だけを借り、複数スタイルを混在させない。

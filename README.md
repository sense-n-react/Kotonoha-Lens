ことのはレンズ
====

## 何ができるのか

[**ことのはたんご｜単語推理ゲーム**](https://plum-chloride.jp/kotonoha-tango/index.html)で比較的簡単に連勝できます。

## 使い方

**ことのはたんご**の評価（緑、黄、灰）の通りに
[ことのはレンズ](https://sense-n-react.github.io/Kotonoha-Lens/kotonoha.html) に文字を入れるだけです。

<img src="https://sense-n-react.github.io/Kotonoha-Lens/Screenshot.png" width="240px">

## 仕組み

約8000語のひらがな５文字の単語をデータベースとして保持しています。
これは人間の語彙力、記憶を助けるものです。
このデータベースは不定期に更新しています。

以下の手順で「候補の単語」を提示します。

1. **ことのはたんご**の評価に従い正規表現を生成
2. その正規表現に一致する単語をデータベースから抽出し、あいうえお順にそれを表示
3. 抽出した単語に含まれる文字の出現頻度を計算し、出現頻度順にそれを表示
4. データベースの単語に対して「出現頻度の高い文字」が含まれている度合いで評価
5. 4.の評価が高い順に「候補を絞り込む単語」として表示

## 注意

辞書にない単語が出題された場合には正解にたどり着けません。
その場合には [語尾検索エンジン](https://bluesnap.net/gobisearch/)のようなサイトを利用して自力で正解してください。

入力の度に上記の処理が走るため画面更新がギクシャクします。

HTML に不慣れなため画面のレイアウトがイマイチです。

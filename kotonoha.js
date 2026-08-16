/*
 * (setq js-indent-level 2)
 */

var start_t    = new Date().getTime();
var log_indent = 0;

function log( msg ) {
  if ( msg == '' ) {
    start_t = new Date().getTime();
  }
  else {
    if ( msg[0] == '<' )  log_indent -= 2;
    let diff  = new Date().getTime() - start_t;
    let space = "                 ".slice( 0, log_indent );
    console.log( "%s: %s%s", ("  " + diff).slice(-3), space, msg );
    if ( msg[0] == '>' )  log_indent += 2;
  }
}

// カタカナ -> ひらがな
function kataToHira( str ) {
  return  str.replace(/[\u30A1-\u30FA]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

// ひらがな -> カタカナ
function hiraToKata(str) {
  return str.replace(/[\u3041-\u3096]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );
}

// 重複除去した上で並べ替えた Array を返す
function uniqSorted( a ) { return Array.from( new Set( a ) ).sort();  }

// innerHTML に生の単語を差し込む前にエスケープする
function escapeHTML( str ) {
  return str.replace( /[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]) );
}

// 連想配列をソートして Array を返す
function dic_sort( dic ) {
  log( "> dic_sort()" );

  let keys = Object.keys( dic );
  log( "size = " + keys.length );

  let array = keys.map( k => ({ key: k, value: dic[k] }) );
  array.sort( (a, b) => b.value - a.value );  // reverse

  log( "<" );
  return array;
}

function update_doc( id, html ) {
  log( "> update_doc " + id  );
  document.getElementById( id ).innerHTML = html;
  log( "<" )
}

const sleep = (msec) => {
  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve();
    }, msec);
  });
};

//
// 定数
//
const CHUNK_YIELD_MS       = 1;   // チャンク処理の合間にイベントループへ制御を戻す待ち時間
const GREP_YIELD_STEP_DIV  = 10;  // grep() のループを何分割してsleepを挟むか
const CANDIDATE_CHUNK_DIV  = 10;  // candidate_words のチャンクサイズ = lines.length / この値
const CANDIDATE_CHUNK_MIN  = 20;  // candidate_words の最小チャンクサイズ
const REFINE_CHUNK_DIV     = 20;  // refine_words のチャンクサイズ = dict.words.length / この値
const HIST_CHARS_COLUMNS   = 6;   // 文字ヒストグラムの1行あたりの表示数
const REFINE_WORDS_COLUMNS = 3;   // 絞り込み候補の1行あたりの表示数
const INPUTS_STORAGE_KEY   = 'kotonoha_lens_inputs'; // 入力欄の内容を保存する localStorage のキー

const cur_chars = {
  hit_1  : "", hit_2  : "", hit_3  : "", hit_4  : "",  hit_5  : "",
  blow_1 : "", blow_2 : "", blow_3 : "", blow_4 : "",  blow_5 : "",
  none : "dummy"  // 初期状態で「入力変化」ありにするため
};

//全 ひらがな
const  KANA_LIST =
      `あいうえお  かきくけこ
       さしすせそ  たちつてと
       なにぬねの  はひふへほ
       まみむめも  やゆよ
       らりるれろ  わ      を
       がぎぐげご  ざじずぜぞ
       だぢづでど  ばびぶべぼ
       ぱぴぷぺぽ  ぁぃぅぇぉ
       っゃゅょ    んー`.replace( /\s+/g, '' ).split('');

const NON_KANA_REGE = new RegExp( "[^" +
                                  KANA_LIST.join('') +
                                  hiraToKata( KANA_LIST.join('') ) +
                                  "]" );
// 単語辞書
const dict = {
  words:       [], // 単語（表記そのまま）
  hira:        [], // 単語をひらがな化したもの
  chars:       [], // 単語に含まれる文字（重複除去 + ソート済み）
  charsShrunk: [], // 異なり文字集合が同じ単語をまとめた版（'いんしょう'と'しょういん'を区別しない）
};

var in_analyze     = false;
var input_pending  = false; // in_analyze 中に入力の変化があったかどうか

function start() {
  log( '' )
  log( "> start");
  //
  // kotonoha.txt を内容から dict.words[] を作る
  //
  let shrinked_DB = new Set();

  const push = (wd) => {
    let hira = kataToHira( wd );
    dict.words.push( wd );
    dict.hira.push( hira );
    let ua = uniqSorted( hira.split( '' ) );   // ['た','ま','て','ば','こ']
    dict.chars.push( ua );                     // ['たまてばこ']
    if ( shrinked_DB.has( ua.join('') ) ) {
      dict.charsShrunk.push( [] );
    }
    else {
      // 'いんしょう' と 'しょういん' を区別しない
      dict.charsShrunk.push( ua );
      shrinked_DB.add( ua.join('') );
    }
  };

  let lead = '';
  db_text.split( /\n/).forEach( line => {
    // 空白 , / で分割
    let words = line.split( /[,、\/／　 ]+/ ).filter( (s) => s != '' );

    if ( words.length == 1 && words[0].length == 5 ) { // 5文字
      // かわりもの
      push( words[0] );
    }
    else if ( words.length > 0 ) {
      //かん　きゃく　きゅう　きょう
      //　　　ぎょう
      if ( line.search( /^[　 ]/ ) == -1 ) { // 行頭が空白ではない
        lead = words.shift();
      }
      words.forEach( wd => {
        push( lead + wd );
      });
    }
  });

  Object.keys(cur_chars).forEach( id => {
    let btn = document.getElementById( id )
    btn.addEventListener( "input", check_input );
  });

  loadInputs();

  log( "< start");
  check_input();
};

//
// 入力欄の内容の永続化（ページの再読み込みでクリアされないように）
//
function saveInputs() {
  let data = {};
  Object.keys(cur_chars).forEach( id => {
    data[id] = document.getElementById( id ).value;
  });
  try {
    localStorage.setItem( INPUTS_STORAGE_KEY, JSON.stringify( data ) );
  } catch (e) {
    console.log( "saveInputs() failed: " + e );
  }
}

function loadInputs() {
  let raw = null;
  try {
    raw = localStorage.getItem( INPUTS_STORAGE_KEY );
  } catch (e) {
    console.log( "loadInputs() failed: " + e );
  }
  if ( !raw ) return;

  try {
    let data = JSON.parse( raw );
    Object.keys(cur_chars).forEach( id => {
      if ( typeof data[id] == 'string' ) {
        document.getElementById( id ).value = data[id];
      }
    });
  } catch (e) {
    console.log( "loadInputs() failed to parse: " + e );
  }
}

function OnClearClick() {
  log( "click() OnClearClick" );
  Object.keys(cur_chars).forEach( id => {
    document.getElementById( id ).value = '';
  });
  check_input();
};

function check_input() {
  saveInputs();

  if ( in_analyze ) {
    // analyze() が終わったタイミングで自分自身が再度呼ばれるようにする
    input_pending = true;
    log( "check_input() delayed: in_analyze" );
    return;
  }

  log( '' );
  log( "> check_input()" );

  // input欄の内容を読み込んで analyze() を呼ぶ
  let changed = false;
  Object.keys(cur_chars).forEach( id => {
    let str = document.getElementById( id ).value;
    if ( str != cur_chars[ id ] && str.search( NON_KANA_REGE ) == -1 )  {
      // かな以外の文字が含まれている場合は analyze() を呼ばない
      changed = true;
      cur_chars[ id ] = kataToHira( str );
    }
  });
  if ( changed ) {
    in_analyze = true;
    analyze();
  }

  log( "< check_input()" );
}

var shrinked = false;
function OnShrinkClick() {
  shrinked = !shrinked;
  log( "click() " + shrinked );
  document.getElementById( "Shrink" ).value = shrinked? "Normal" : "Shrink";
  refine();
};
//
//
// 直近の検索結果に関する状態
let searchState = {
  candidateChars: {},   // 現在の候補単語に含まれる文字とその出現回数
  mustRE:         null, // 「当たり」「おしい」文字にマッチする正規表現
  mustKanaDic:    {},   // 「当たり」「おしい」文字の有無を引けるハッシュ
};

//
// チャンクに分割しながら、時々 event loop に制御を渡しつつ
// html を組み立てて id の要素に反映する（重い整形処理の共通化）
//
async function renderChunked( id, items, chunkSize, formatChunk ) {
  let doc = '';
  for ( let i = 0; i < items.length; i += chunkSize ) {
    doc += formatChunk( items.slice( i, i + chunkSize ) ) + "<br>";
    await sleep( CHUNK_YIELD_MS );
  }
  update_doc( id, doc );
}

async function grep( pattern, blow_chars, ng_chars ) {
  log( "> grep( "+ pattern + ")" );

  let candidate_words = [];
  searchState.candidateChars = {};

  let match_re = new RegExp( kataToHira( pattern ) )
  let ng_re    = new RegExp( "[" + kataToHira( ng_chars ) + "]" );

  let blow_a   = blow_chars.split('')
  let lines    = [];
  let step     = Math.max( 1, Math.floor( dict.words.length / GREP_YIELD_STEP_DIV ) );

  for ( let i = 0; i < dict.words.length; ++i ) {
    // 8000回ループの間、時々 event loopに制御を渡す
    if ( i % step == 0 ) { await sleep( CHUNK_YIELD_MS ); }

    let wd = dict.hira[i];

    if (
      // おしい文字全てが含まれている
      ( blow_a.length == 0 || blow_a.every( (c) => wd.indexOf(c) >= 0 ) ) &&
        // どの NG 文字にも一致しない
      ( ng_chars.length == 0 || wd.search( ng_re ) == -1 ) &&
        // 検索パターンに一致
      ( wd.search( match_re ) >= 0 ) ) {

      // 候補単語に追加
      candidate_words.push( dict.words[i] );
      // 文字の使用頻度
      dict.chars[i].forEach( c => {
        searchState.candidateChars[c] = ( searchState.candidateChars[c] || 0 ) + 1;
      });
      // ５単語 単位で改行
      if ( ( candidate_words.length - 1 ) % 5 == 0 ) {      // 行頭
        lines.push( escapeHTML( dict.words[i] ) );
      }
      else {
        lines[ lines.length - 1 ] += "　" + escapeHTML( dict.words[i] );  // 空白に続けて追加
      }
    }
  }

  let html = [
    ( blow_chars.length > 0 )? ( "「" + blow_chars + "」を含み、<br>" ) : '',
    ( ng_chars.length > 0   )? ( "「" + ng_chars + "」を含まず、<br>" ) : '',
    "'",
    pattern.replace(/\./g,'・').replace( /\[(.)\]/g, "$1" ),
    "' に一致する候補：",
    candidate_words.length + "件<br>"
  ].join('');

  update_doc( 'grep_condition',  html );

  // 候補単語に色を付ける処理が重たいので
  // 分割処理して、時々 event loop に制御を渡す
  let sub_len = Math.max( CANDIDATE_CHUNK_MIN, Math.floor( lines.length / CANDIDATE_CHUNK_DIV ) );
  await renderChunked( 'candidate_words', lines, sub_len, chunk =>
    chunk.join( "<br>" ).replace( searchState.mustRE, '<span class="B">$&</span>' )
  );

  log( "< grep()" );
}

//
// 候補単語の含まれる文字のヒストグラム
//
async function show_used_chars() {
  log( "> show_used_chars()" );

  //  searchState.candidateChars : { k1:v1, k2:v2, ,,, ]    c と その出現回数
  //  dic_sort : [{km:vm}, {kn:vn} ....]     <= {k:v} の配列にして v でsort
  //
  let chars = dic_sort( searchState.candidateChars );
  let text = ""
  for ( let i = 0; i < chars.length; i += HIST_CHARS_COLUMNS ) {
    text += chars.slice( i, i + HIST_CHARS_COLUMNS ).
      map( (h) => ( '    ' + h.value ).slice( -4 ) + ':' + h.key ).
      join( '　' ).
      replace( searchState.mustRE, '<span class="B">$&</span>' ) + "<br>";
  }

  // must_chars を赤で表示
  update_doc( 'hist_chars',
              text
            );

  log( "< show_used_chars()" );
  // 検索結果をさらに絞り込むために効果的な単語をリストする
}


//
// 絞り込みのための候補単語の表示
//
async function refine() {
  log( "> refine()" );

  log( "> dict.words.forEach" );
  // dict.words[] の単語に rate で重みを付ける
  let score = {}

  let hira_db = ( shrinked )? dict.charsShrunk : dict.chars;
  for ( let i = 0; i < dict.words.length; i++ ) {
    let s   = 0;
    hira_db[i].forEach( ( c ) => {
      s += ( searchState.mustKanaDic[ c ] == 0 )? ( searchState.candidateChars[c] || 0 ) : 0;
    });
    if ( s > 0 ) score[ dict.words[i] ] = s;
  }

  log( "< dict.words.forEach" );
  // => { けものみち:9, わさびもち:10, ちょっけつ: 8,,, }

  // 重みでソート、重みゼロをフィルタリング
  // 行単位でスライス
  let score_hist = dic_sort( score );
  let lines = [];
  log( "> make lines" );
  for ( let i = 0; i < score_hist.length; i += REFINE_WORDS_COLUMNS ) {
    lines.push( score_hist.slice( i, i + REFINE_WORDS_COLUMNS ).
                map( sc => ('    ' + sc.value ).slice( -5 ) + ':' + escapeHTML( sc.key ) ).
                join( '　' )
              );
  }
  log( "<" );
  // => " 10:わさびもち　9:おともだち　9: けものみち"
  //    "  8:ちょっけつ
  //

  // 検索結果の中の candidate_words に含まれない文字をorange表示
  // するための RegExp => rege2
  // 候補単語の文字を削除
  let unused_chars = KANA_LIST.join('').replace(
    new RegExp( '[' + Object.keys( searchState.candidateChars ).join('') + ']', 'g' ),
    '' );
  let unused_re = new RegExp( '[' + unused_chars + hiraToKata(unused_chars) + ']+', 'g' );

  // 候補単語に色を付ける処理が重たいので、分割処理して時々 event loop に制御を渡す
  let sub_len = Math.max( 1, Math.floor( dict.words.length / REFINE_CHUNK_DIV ) );
  await renderChunked( 'refine_words', lines, sub_len, chunk =>
    chunk.join( "<br>" ).
      replace( searchState.mustRE, '<span class="R">$&</span>' ).
      replace( unused_re,          '<span class="O">$&</span>' )
  );
  update_doc( 'refine_num', '' + score_hist.length );
  log( "< refine()" );
}

//
// キー入力で呼ばれる
// <input>の内容を取り出して grep(), show_used_chars() を呼ぶ
//
async function analyze() {
  log( "> analyze()" );
  const h = (i) => cur_chars[ "hit_"  + i ];  // 当たりの文字
  const b = (i) => cur_chars[ "blow_" + i ];  // おしい文字

  let hit_c  =  [1,2,3,4,5].map( i => h(i) ).join('');
  let blow_c =  [1,2,3,4,5].map( i => b(i) ).join('');
  let pattern = [1,2,3,4,5].map( i =>
    ( h(i).length > 0 )? ( '['  + h(i) + ']' ) : //そこに含まれる
    ( b(i).length > 0 )? ( '[^' + b(i) + ']' ) : // そこには含まれない
    '.'                                          // なんでもOK
  ).join('');
  let ng_chars = cur_chars[ "none" ];

  // 必ず含まれる文字の RegEx
  let must_chars = uniqSorted( ( hit_c + blow_c ).split('') ).join('');
  KANA_LIST.forEach( c => {
    searchState.mustKanaDic[ c ]  = must_chars.indexOf( c ) >= 0 ? 1: 0;
  });
  searchState.mustRE = new RegExp( '[' + must_chars + hiraToKata(must_chars) + ']', 'g' );

  // blow_chars を含み、cur_chars[ "none" ]を含まず
  // pattern にマッチする 単語 を調べる
  // その単語に含まれる文字 => searchState.candidateChars
  await grep( pattern, blow_c, ng_chars );

  // 検索結果の単語に含まれる文字(searchState.candidateChars)を頻度順に表示
  await show_used_chars();

  // 絞り込みのための候補単語を表示
  await refine();

  log( "< analyze()" );
  in_analyze = false;

  // analyze() 実行中に入力が変化していたら、続けてチェックする
  if ( input_pending ) {
    input_pending = false;
    check_input();
  }
}

start();

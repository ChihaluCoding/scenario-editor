import { nanoid } from 'nanoid'
import type { Project } from '@/types'
import { newCharacter, newScene, newVariable } from './factory'

/** 分岐・合流・変数による条件分岐を含む動作確認用サンプル。 */
export function sampleProject(): Project {
  const yui = newCharacter('結衣', 0)
  const senpai = newCharacter('先輩', 1)

  const affection = { ...newVariable('好感度', 'number'), initial: 0, note: '結衣の先輩への好感度' }
  const knowsSecret = { ...newVariable('秘密を知っている', 'boolean'), initial: false, note: '屋上ルートで真相を聞いたか' }

  const s1 = newScene('放課後の教室', { x: 0, y: 0 })
  const s2 = newScene('屋上ルート', { x: -260, y: 220 })
  const s3 = newScene('図書室ルート', { x: 260, y: 220 })
  const s4 = newScene('合流：帰り道', { x: 0, y: 460 })
  const s5 = newScene('エピローグ（好感度が高い場合）', { x: 0, y: 700 })

  s1.summary = '導入。二人きりの教室で分岐が発生する。'
  s1.chapter = '共通ルート'
  s1.status = 'done'
  s1.lines = [
    { id: nanoid(8), kind: 'narration', text: '夕暮れの教室。窓の外では、部活動の掛け声が遠く響いている。' },
    { id: nanoid(8), kind: 'say', charId: yui.id, text: '……あれ、先輩。まだ残ってたんですね。', voice: '' },
    { id: nanoid(8), kind: 'say', charId: senpai.id, text: 'ん。ちょっと考え事してた。……そっちこそ。', voice: '' },
    {
      id: nanoid(8),
      kind: 'choice',
      prompt: 'どこへ誘う？',
      options: [
        {
          id: nanoid(6),
          text: '屋上に誘う',
          next: s2.id,
          whenLocked: 'hide',
          effects: [{ id: nanoid(6), varId: affection.id, op: 'add', value: 2 }],
        },
        {
          id: nanoid(6),
          text: '図書室に行こうと言う',
          next: s3.id,
          whenLocked: 'hide',
          effects: [{ id: nanoid(6), varId: affection.id, op: 'add', value: 1 }],
        },
      ],
    },
  ]

  s2.summary = '開放的なルート。先輩の本音が出て、秘密フラグが立つ。'
  s2.chapter = '個別ルート'
  s2.tags = ['屋上', '秘密']
  s2.status = 'review'
  s2.lines = [
    { id: nanoid(8), kind: 'narration', text: '風が強い。フェンス越しの空が、やけに広く見えた。' },
    { id: nanoid(8), kind: 'say', charId: senpai.id, text: 'こんなとこ連れてきて、なに話すつもり？', voice: '' },
    { id: nanoid(8), kind: 'say', charId: yui.id, text: '……別に。ただ、風に当たりたかっただけです。', voice: '' },
    { id: nanoid(8), kind: 'say', charId: senpai.id, text: '……実は、来月で転校するんだ。', voice: '' },
    { id: nanoid(8), kind: 'set', effects: [{ id: nanoid(6), varId: knowsSecret.id, op: 'set', value: true }] },
    { id: nanoid(8), kind: 'jump', next: s4.id },
  ]

  s3.summary = '静かなルート。距離が近づく。'
  s3.chapter = '個別ルート'
  s3.tags = ['図書室']
  s3.status = 'writing'
  s3.lines = [
    { id: nanoid(8), kind: 'narration', text: '紙とインクの匂い。司書のいないカウンターに、夕日が落ちている。' },
    { id: nanoid(8), kind: 'say', charId: yui.id, text: '静かなところの方が、話しやすいかなって。', voice: '' },
    { id: nanoid(8), kind: 'note', text: 'ここに図書室限定のイベントを追加する予定' },
    { id: nanoid(8), kind: 'jump', next: s4.id },
  ]

  s4.summary = '共通ルート。秘密を知っているかどうかでセリフが変わる。'
  s4.chapter = '共通ルート'
  s4.status = 'done'
  s4.lines = [
    { id: nanoid(8), kind: 'narration', text: '校門を出るころには、空はもう藍色に沈んでいた。' },
    {
      id: nanoid(8),
      kind: 'say',
      charId: yui.id,
      text: '……転校のこと、まだ誰にも言ってないんですか。',
      voice: '',
      cond: { mode: 'all', items: [{ id: nanoid(6), varId: knowsSecret.id, op: '==', value: true }] },
    },
    { id: nanoid(8), kind: 'say', charId: senpai.id, text: 'また明日な。', voice: '' },
    {
      id: nanoid(8),
      kind: 'jump',
      next: s5.id,
      cond: { mode: 'all', items: [{ id: nanoid(6), varId: affection.id, op: '>=', value: 2 }] },
    },
  ]

  s5.summary = '好感度2以上のときだけ到達する追加エンディング。'
  s5.chapter = 'エンディング'
  s5.status = 'done'
  s5.ending = 'good'
  s5.lines = [
    { id: nanoid(8), kind: 'narration', text: '——それから一週間後。駅のホームで、私は小さく手を振った。' },
    { id: nanoid(8), kind: 'say', charId: senpai.id, text: '……ちゃんと、見送りに来たんだ。', voice: '' },
  ]

  return {
    version: 5,
    id: `p_${nanoid(10)}`,
    title: 'サンプル：放課後の分岐',
    author: '',
    characters: [yui, senpai],
    variables: [affection, knowsSecret],
    templates: [],
    variablePresets: [],
    scenes: [s1, s2, s3, s4, s5],
    startSceneId: s1.id,
  }
}

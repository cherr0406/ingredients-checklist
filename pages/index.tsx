import styles from './index.module.css';
import Layout from '@/components/layout';
import { useState } from 'react';
import Table, { TableProps } from '@/components/table';
import useSWRMutation, { MutationFetcher } from 'swr/mutation';

const tablePropsFetcher: MutationFetcher<TableProps[]> = async (apiUrl: string) => {
  // 入力されたURLを取得
  const urlInput: HTMLInputElement | null = document.getElementById(
    'url'
  ) as HTMLInputElement | null;
  const urls = urlInput?.value.split(',');
  if (!urls) {
    console.error('URLが入力されていません。');
    throw new Error('URLが入力されていません。');
  }

  const data: TableProps[] = [];
  // API Routeにリクエスト
  for (const url of urls) {
    const res = await fetch(apiUrl + '?url=' + encodeURIComponent(url));
    // エラーハンドリング
    if (!res.ok) {
      const errorRes = await res.json();
      throw new Error(errorRes.error);
    }
    const result = await res.json();

    // テーブルに追加
    data.push(...result);
  }

  return data;
};

export default function Home() {
  const [tableData, setTableData] = useState<TableProps[]>([]);
  const [isTableShow, setTableShow] = useState<boolean>(false);
  const [displayMsg, setDisplayMsg] = useState<string>('結果がここに表示されます');
  const { trigger, isMutating } = useSWRMutation('/api/scraping', tablePropsFetcher);

  // テーブルを表示
  function resultElement(isTableShow: boolean) {
    if (isTableShow) {
      return (
        <Table
          data={tableData}
          handleChangeChecked={(e) => checked(e)}
          handleSorted={(data) => setTableData(data)}
          handleReset={() => resetTable()}
          handleGroup={() => groupTable()}
        ></Table>
      );
    } else {
      return <div>{displayMsg}</div>;
    }
  }

  // 取得ボタンを押したときの処理
  async function clicked() {
    // API Routeに再リクエスト
    try {
      const newData = await trigger();

      setTableData((prev) => {
        return [...prev, ...newData];
      });
      setTableShow(true);
    } catch (e) {
      let message = '不明なエラーが発生しました。';
      if (e instanceof Error) {
        message = e.message;
      }
      setDisplayMsg(message);
      setTableShow(false);
    }
  }

  // チェックボックスを押したときの処理
  function checked(el: any) {
    setTableData((prev) => {
      const newResult = [...prev];
      newResult[el.target.id].checked = el.target.checked;
      return newResult;
    });
  }

  function resetTable() {
    setTableData([]);
  }

  function groupTable() {
    // 同じingredientを持つTablePropsをまとめる
    const newResult: TableProps[] = [];
    const ingredients = new Set<string>();
    for (const row of tableData) {
      if (!ingredients.has(row.ingredient)) {
        newResult.push(row);
        ingredients.add(row.ingredient);
      } else {
        const index = newResult.findIndex((v) => v.ingredient === row.ingredient);
        newResult[index].amount += '+' + row.amount;
      }
    }
    setTableData(newResult);
  }

  return (
    <Layout title="Ingredients Checklist">
      <main className={styles.main}>
        <div className={styles.description}>
          <p>材料リストを取ってくるレシピのURLを入力してください</p>
          <p>対応サイト: bazurecipe.com, cookien.com, delishkitchen.tv, cookpad.com</p>
          <p>※取得ボタンをむやみに押さないでください。</p>
          <div className={styles.form}>
            <input
              type="text"
              id="url"
              className={styles.input}
              placeholder="https://example.com"
              disabled={isMutating}
            />
            <button className={styles.button} onClick={clicked}>
              取得
            </button>
          </div>
        </div>
        <div className={styles.result}>{resultElement(isTableShow)}</div>
      </main>
    </Layout>
  );
}

import styles from "./index.module.css";
import Layout from "../components/layout";
import { useState } from "react";
import Table, { TableProps } from "@/components/table";

export default function Home() {
  const [resultComponent, setResultComponent] = useState<TableProps[]>([]);
  const [isTableShow, setTableShow] = useState(false);
  const [errorMsg, setErrorMsg] = useState("結果がここに表示されます");

  function resultElement(isTableShow: boolean) {
    if (isTableShow) {
      return (
        <Table
          data={resultComponent}
          handleChangeChecked={(e) => checked(e)}
          handleSorted={(data) => setResultComponent(data)}
          handleReset={() => resetTable()}
        ></Table>
      );
    } else {
      return <div>{errorMsg}</div>;
    }
  }

  async function clicked() {
    console.log("clicked");
    const urlInput: HTMLInputElement | null = document.getElementById(
      "url"
    ) as HTMLInputElement | null;
    const url = urlInput?.value;
    if (!url) {
      return;
    }
    try {
      const response = await fetch(
        `/api/scraping?url=${encodeURIComponent(url)}`
      );
      const data = await response.json();
      if (!response.ok) {
        // ステータスコードが200番台以外の場合
        throw new Error(response.statusText + "\n" + data.error || "");
      } else if (!Array.isArray(data)) {
        // dataの型がTableProps[]か判定
        throw new Error(data);
      } else if (data.length === 0) {
        // dataの長さが0の場合
        throw new Error("材料が取得できませんでした。");
      }
      setResultComponent(data);
      setTableShow(true);
      console.log("Successfully fetched data");
    } catch (error) {
      if (error instanceof Error) {
        setErrorMsg(error.message);
      }
      setTableShow(false);
      console.error(error);
    }
  }

  function checked(e: any) {
    setResultComponent((prev) => {
      const newResult = [...prev];
      newResult[e.target.id].checked = e.target.checked;
      return newResult;
    });
  }

  function resetTable() {
    setResultComponent([]);
  }

  return (
    <Layout>
      <main className={styles.main}>
        <div className={styles.description}>
          <p>材料リストを取ってくるレシピのURLを入力してください</p>
          <div className={styles.form}>
            <input
              type="text"
              id="url"
              className={styles.input}
              placeholder="https://example.com"
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

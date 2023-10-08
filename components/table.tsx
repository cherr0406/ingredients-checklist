import styles from "./table.module.css";
import { ChangeEvent, useCallback, useEffect, useState } from "react";

export interface TableProps {
  checked: boolean;
  ingredient: string;
  amount: string;
  other?: string;
}

interface Props {
  data: TableProps[];
  handleChangeChecked: (e: ChangeEvent<HTMLInputElement>) => void;
  handleSorted: (data: TableProps[]) => void;
  handleReset: () => void;
  handleGroup: () => void;
}

export default function Table({ data, handleChangeChecked, handleSorted, handleReset, handleGroup }: Props) {
  const [tbodyElem, setTbodyElem] = useState<JSX.Element>();

  // チェック済のものを下に持ってくる
  function sortData() {
    const checkedData: TableProps[] = data.filter((row: TableProps) => {
      return row.checked;
    });
    const uncheckedData: TableProps[] = data.filter((row: TableProps) => {
      return !row.checked;
    });
    handleSorted([...uncheckedData, ...checkedData]);
    setTbodyElem(<tbody>{mapTableData([...uncheckedData, ...checkedData])}</tbody>);
  }

  // テーブルのデータをmapする（メモ化）
  const mapTableData = useCallback(
    (data: TableProps[]) => {
      return data.map((row: TableProps, i: number) => {
        return (
          <tr key={i}>
            <td>
              <input
                className={styles.checkbox}
                type="checkbox"
                id={i.toString()}
                checked={row.checked}
                onChange={(e: ChangeEvent<HTMLInputElement>) => handleChangeChecked(e)}
              />
            </td>
            <td>{row.ingredient}</td>
            <td>{row.amount}</td>
          </tr>
        );
      });
    },
    [handleChangeChecked]
  );

  // Propsに依存する処理はuseEffectで行う
  useEffect(() => {
    setTbodyElem(<tbody>{mapTableData(data)}</tbody>);
  }, [data, handleChangeChecked, mapTableData]);

  return (
    <div className={styles.container}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>
              <button className={styles.sortButton} onClick={sortData}>
                sort
              </button>
            </th>
            <th>材料</th>
            <th>量</th>
          </tr>
        </thead>
        {tbodyElem}
      </table>
      <div className={styles.buttonContainer}>
        <button onClick={handleGroup}>同じ材料をまとめる</button>
        <button onClick={handleReset}>reset</button>
      </div>
    </div>
  );
}

import { useEffect } from "react";
import { useProjectStore } from "../store/project-store.js";
import "./ProjectList.css";

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Lists every project saved in this browser (IndexedDB), lets the user
 * switch between them or delete one. There is still only one project open
 * in the editor at a time — this is a switcher, not a multi-pane view.
 */
export function ProjectList() {
  const projects = useProjectStore((s) => s.projects);
  const currentProjectId = useProjectStore((s) => s.project.id);
  const refreshProjectList = useProjectStore((s) => s.refreshProjectList);
  const openProject = useProjectStore((s) => s.openProject);
  const deleteProjectById = useProjectStore((s) => s.deleteProjectById);

  useEffect(() => {
    void refreshProjectList();
  }, [refreshProjectList]);

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`"${name}" 프로젝트를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
    void deleteProjectById(id);
  }

  if (projects.length === 0) {
    return <p className="project-list-empty">저장된 프로젝트가 없습니다. 편집을 시작하면 자동으로 저장됩니다.</p>;
  }

  return (
    <ul className="project-list">
      {projects.map((p) => {
        const isCurrent = p.id === currentProjectId;
        return (
          <li key={p.id} className={isCurrent ? "project-list-item project-list-item--current" : "project-list-item"}>
            <div className="project-list-info">
              <span className="project-list-name">{p.name}</span>
              <span className="project-list-updated">{formatUpdatedAt(p.updatedAt)}</span>
            </div>
            <div className="project-list-actions">
              <button type="button" onClick={() => void openProject(p.id)} disabled={isCurrent}>
                {isCurrent ? "현재 열림" : "열기"}
              </button>
              <button type="button" onClick={() => handleDelete(p.id, p.name)}>
                삭제
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

(function () {
  "use strict";

  const AUTOSAVE_KEY = "student-life-mindmap-autosave-v1";
  const PROJECT_VERSION = 1;
  const AREAS = ["학업역량", "탐구역량", "공동체역량"];
  const CATEGORY_ORDER = ["출결", "창체", "교과성적", "교과세특", "행발"];
  const COURSE_SUBCATEGORIES = ["국어", "수학", "영어", "사회", "과학", "교양예술"];
  const AREA_META = {
    "학업역량": { short: "학업", cls: "academic", color: "#4f927d", bg: "#d9ebe4" },
    "탐구역량": { short: "탐구", cls: "inquiry", color: "#b8778f", bg: "#f1dde5" },
    "공동체역량": { short: "공동체", cls: "community", color: "#aa8d31", bg: "#f3e7b7" }
  };
  const CORE_NODES = [
    { id: "core-academic", type: "core", area: "학업역량", label: "학업", x: 180, y: 120 },
    { id: "core-inquiry", type: "core", area: "탐구역량", label: "탐구", x: 500, y: 120 },
    { id: "core-community", type: "core", area: "공동체역량", label: "공동체", x: 820, y: 120 }
  ];
  const SVG_NS = "http://www.w3.org/2000/svg";
  const XHTML_NS = "http://www.w3.org/1999/xhtml";

  let state = createDefaultState();
  let editingActivityId = null;
  let selected = { type: null, id: null };
  let currentTab = "activities";
  let pendingActivityId = null;
  let connectStartId = null;
  let groupMoveId = null;
  let undoStack = [];
  let autosaveTimer = null;
  let toastTimer = null;
  let activitySearchQuery = "";
  let sideSearchQuery = "";
  let dragState = null;
  let panState = null;
  let pinchState = null;
  const activePointers = new Map();
  let suppressNodeClickUntil = 0;

  const els = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    bindEvents();
    updateSubcategoryControl();
    updateSecondaryOptions();
    updateCharacterCounts();
    renderAll();
    showAutosavePromptIfNeeded();
  }

  function cacheElements() {
    const ids = [
      "autosaveBanner", "autosaveInfo", "restoreAutosaveBtn", "dismissAutosaveBtn", "saveStatus",
      "studentNumber", "studentName", "helpBtn", "helpModal", "loadProjectBtn", "saveProjectBtn",
      "resetProjectBtn", "projectFileInput", "activityForm",
      "activityGrade", "activityCategory", "activitySubcategorySelect",
      "activitySubjectDetail", "activityFormat",
      "primaryArea", "secondaryArea", "activityTopic", "activityMemo",
      "submitActivityBtn", "cancelEditBtn", "deleteActivityBtn", "activitySearch",
      "activitySearchBtn", "activitySearchResetBtn", "topicCount", "memoCount",
      "activitySort", "activityTableBody", "copyTableBtn", "saveTsvBtn",
      "printTableBtn", "solidFlowName", "outlineFlowName", "undoBtn", "zoomOutBtn",
      "zoomResetBtn", "zoomInBtn", "fitViewBtn", "printModeSelect", "printSelectedBtn",
      "mindmapSvg", "viewportGroup",
      "edgesGroup", "edgeLabelsGroup", "nodesGroup", "placementHint",
      "showKeywordFormBtn", "keywordForm", "keywordTitle", "keywordMemo",
      "cancelKeywordBtn", "sideSearch", "sideSearchBtn", "sideGradeFilter", "sidePlacedFilter",
      "sideActivityList", "detailContent", "activityPanel", "detailPanel", "toast"
    ];
    ids.forEach((id) => {
      els[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    document.querySelectorAll(".tab").forEach((button) => {
      button.addEventListener("click", () => switchTab(button.dataset.tab));
    });

    els.studentNumber.addEventListener("input", () => {
      state.student.number = els.studentNumber.value.trim();
      scheduleAutosave();
    });
    els.studentName.addEventListener("input", () => {
      state.student.name = els.studentName.value.trim();
      scheduleAutosave();
    });

    els.loadProjectBtn.addEventListener("click", requestProjectLoad);
    els.projectFileInput.addEventListener("change", loadProjectFile);
    els.saveProjectBtn.addEventListener("click", saveProject);
    els.resetProjectBtn.addEventListener("click", resetProject);
    els.helpBtn.addEventListener("click", openHelpModal);
    els.helpModal.addEventListener("click", (event) => {
      if (event.target === els.helpModal || event.target.closest("[data-close-help]")) {
        closeHelpModal();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !els.helpModal.hidden) closeHelpModal();
    });

    els.restoreAutosaveBtn.addEventListener("click", restoreAutosave);
    els.dismissAutosaveBtn.addEventListener("click", () => {
      els.autosaveBanner.hidden = true;
    });

    els.activityCategory.addEventListener("change", updateSubcategoryControl);
    els.primaryArea.addEventListener("change", updateSecondaryOptions);
    els.activityTopic.addEventListener("input", updateCharacterCounts);
    els.activityMemo.addEventListener("input", updateCharacterCounts);
    els.activityForm.addEventListener("submit", submitActivityForm);
    els.cancelEditBtn.addEventListener("click", cancelActivityEdit);
    els.deleteActivityBtn.addEventListener("click", deleteEditingActivity);
    els.activitySearchBtn.addEventListener("click", applyActivitySearch);
    els.activitySearchResetBtn.addEventListener("click", resetActivitySearch);
    els.activitySearch.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        applyActivitySearch();
      }
    });
    els.activitySort.addEventListener("change", renderActivityTable);
    els.copyTableBtn.addEventListener("click", copyActivityTable);
    els.saveTsvBtn.addEventListener("click", saveActivityTsv);
    els.printTableBtn.addEventListener("click", printActivityTable);

    els.solidFlowName.addEventListener("input", () => {
      state.mindmap.starLabels.solid = els.solidFlowName.value;
      scheduleAutosave();
    });
    els.outlineFlowName.addEventListener("input", () => {
      state.mindmap.starLabels.outline = els.outlineFlowName.value;
      scheduleAutosave();
    });

    els.undoBtn.addEventListener("click", undoMindmap);
    els.zoomOutBtn.addEventListener("click", () => setZoom(state.mindmap.viewport.scale - 0.1));
    els.zoomResetBtn.addEventListener("click", () => {
      state.mindmap.viewport.scale = 1;
      renderMindmap();
      scheduleAutosave();
    });
    els.zoomInBtn.addEventListener("click", () => setZoom(state.mindmap.viewport.scale + 0.1));
    els.fitViewBtn.addEventListener("click", fitView);
    els.printSelectedBtn.addEventListener("click", printSelectedMindmap);

    els.mindmapSvg.addEventListener("pointerdown", onSvgPointerDown);
    els.mindmapSvg.addEventListener("dragover", (event) => event.preventDefault());
    els.mindmapSvg.addEventListener("drop", onActivityDrop);
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);
    window.addEventListener("pointercancel", onWindowPointerUp);
    window.addEventListener("blur", clearActivePointers);

    els.showKeywordFormBtn.addEventListener("click", () => {
      els.keywordForm.hidden = !els.keywordForm.hidden;
      if (!els.keywordForm.hidden) els.keywordTitle.focus();
    });
    els.keywordForm.addEventListener("submit", submitKeywordForm);
    els.cancelKeywordBtn.addEventListener("click", clearKeywordForm);

    document.querySelectorAll(".panel-tab").forEach((button) => {
      button.addEventListener("click", () => switchPanel(button.dataset.panel));
    });
    els.sideSearchBtn.addEventListener("click", applySideSearch);
    els.sideSearch.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        applySideSearch();
      }
    });
    els.sideGradeFilter.addEventListener("change", renderSideActivityList);
    els.sidePlacedFilter.addEventListener("change", renderSideActivityList);
  }

  function createDefaultState() {
    return {
      version: PROJECT_VERSION,
      student: { number: "", name: "" },
      counters: { "1": 0, "2": 0, "3": 0 },
      activities: [],
      mindmap: {
        nodes: CORE_NODES.map((node) => ({ ...node })),
        edges: [],
        starLabels: { solid: "", outline: "" },
        viewport: { offsetX: 48, offsetY: 52, scale: 1 }
      }
    };
  }

  function renderAll() {
    syncInputsFromState();
    renderActivityTable();
    renderSideActivityList();
    renderMindmap();
    renderDetail();
    updateUndoButton();
  }

  function syncInputsFromState() {
    els.studentNumber.value = state.student.number || "";
    els.studentName.value = state.student.name || "";
    els.solidFlowName.value = state.mindmap.starLabels.solid || "";
    els.outlineFlowName.value = state.mindmap.starLabels.outline || "";
  }

  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll(".tab").forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === tab);
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === `${tab}Tab`);
    });
    if (tab === "mindmap") {
      setTimeout(renderMindmap, 0);
    }
  }

  function switchPanel(panel) {
    document.querySelectorAll(".panel-tab").forEach((button) => {
      button.classList.toggle("active", button.dataset.panel === panel);
    });
    els.activityPanel.classList.toggle("active", panel === "activity");
    els.detailPanel.classList.toggle("active", panel === "detail");
  }

  function openHelpModal() {
    els.helpModal.hidden = false;
    els.helpModal.querySelector("[data-close-help]")?.focus();
  }

  function closeHelpModal() {
    els.helpModal.hidden = true;
    els.helpBtn.focus();
  }

  function updateSubcategoryControl() {
    const category = els.activityCategory.value;
    els.activitySubcategorySelect.innerHTML = "";
    let options = [""];
    let disabled = false;
    if (category === "창체") {
      options = ["", "자율", "동아리", "진로", "봉사"];
    } else if (isCourseCategory(category)) {
      options = ["", ...COURSE_SUBCATEGORIES];
    } else if (category === "출결" || category === "행발") {
      options = ["없음"];
      disabled = true;
    }
    options.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value || "선택";
      els.activitySubcategorySelect.appendChild(option);
    });
    els.activitySubcategorySelect.disabled = disabled;
    if (disabled) els.activitySubcategorySelect.value = "없음";
    els.activitySubjectDetail.disabled = !isCourseCategory(category);
    els.activitySubjectDetail.placeholder = isCourseCategory(category) ? "예: 윤리와 사상" : "교과 항목에서 입력";
    if (!isCourseCategory(category)) els.activitySubjectDetail.value = "";
  }

  function updateSecondaryOptions() {
    const primary = els.primaryArea.value;
    Array.from(els.secondaryArea.options).forEach((option) => {
      option.disabled = option.value && option.value === primary;
    });
    if (els.secondaryArea.value === primary) {
      els.secondaryArea.value = "";
    }
  }

  function submitActivityForm(event) {
    event.preventDefault();
    const activity = readActivityForm();
    if (!activity) return;

    const duplicate = state.activities.find((item) => {
      return item.topic === activity.topic && item.id !== editingActivityId;
    });
    if (duplicate && !confirm("완전히 같은 활동주제가 있다. 그래도 저장할까?")) {
      return;
    }

    if (editingActivityId) {
      const index = state.activities.findIndex((item) => item.id === editingActivityId);
      if (index >= 0) {
        state.activities[index] = { ...state.activities[index], ...activity };
      }
    } else {
      const id = createId("act");
      const sequence = nextHiddenSequence(activity.grade);
      state.activities.push({
        id,
        sequence,
        createdAt: Date.now(),
        ...activity
      });
    }
    clearActivityForm();
    renderActivityTable();
    renderSideActivityList();
    renderMindmap();
    renderDetail();
    scheduleAutosave();
  }

  function readActivityForm() {
    const grade = els.activityGrade.value;
    const category = els.activityCategory.value;
    let subcategory = els.activitySubcategorySelect.value;
    if (category === "출결" || category === "행발") subcategory = "없음";
    const subjectDetail = isCourseCategory(category) ? els.activitySubjectDetail.value.trim() : "";
    const topic = els.activityTopic.value.trim();
    const format = els.activityFormat.value.trim();
    const primaryArea = els.primaryArea.value;
    const secondaryArea = els.secondaryArea.value;
    const memo = els.activityMemo.value.trim();

    if (!grade) return showValidation("학년을 선택해야 한다.");
    if (!category) return showValidation("항목을 선택해야 한다.");
    if ((category === "창체" || isCourseCategory(category)) && !subcategory) {
      return showValidation("세부항목을 입력해야 한다.");
    }
    if (!topic) return showValidation("활동주제를 입력해야 한다.");
    if (topic.length > 100) return showValidation("활동주제는 100자 이내로 입력해야 한다.");
    if (!format) return showValidation("형식을 입력해야 한다.");
    if (format.length > 50) return showValidation("형식은 50자 이내로 입력해야 한다.");
    if (!primaryArea) return showValidation("평가영역1을 선택해야 한다.");
    if (secondaryArea && secondaryArea === primaryArea) {
      return showValidation("평가영역2는 평가영역1과 다르게 선택해야 한다.");
    }
    if (memo.length > 300) return showValidation("메모는 300자 이내로 입력해야 한다.");
    return { grade, category, subcategory, subjectDetail, topic, format, primaryArea, secondaryArea, memo };
  }

  function showValidation(message) {
    showToast(message);
    return null;
  }

  function updateCharacterCounts() {
    els.topicCount.textContent = `${els.activityTopic.value.length}/100`;
    els.memoCount.textContent = `${els.activityMemo.value.length}/300`;
  }

  function applyActivitySearch() {
    activitySearchQuery = normalize(els.activitySearch.value);
    renderActivityTable();
  }

  function resetActivitySearch() {
    activitySearchQuery = "";
    els.activitySearch.value = "";
    renderActivityTable();
  }

  function applySideSearch() {
    sideSearchQuery = normalize(els.sideSearch.value);
    renderSideActivityList();
  }

  function resetSideSearch() {
    sideSearchQuery = "";
    els.sideSearch.value = "";
    renderSideActivityList();
  }

  function nextHiddenSequence(grade) {
    state.counters[grade] = (state.counters[grade] || 0) + 1;
    return `${grade}-${String(state.counters[grade]).padStart(2, "0")}`;
  }

  function editActivity(id) {
    const activity = getActivity(id);
    if (!activity) return;
    editingActivityId = id;
    els.submitActivityBtn.textContent = "수정 저장";
    els.cancelEditBtn.hidden = false;
    els.deleteActivityBtn.hidden = false;
    els.activityGrade.value = activity.grade;
    els.activityCategory.value = activity.category;
    updateSubcategoryControl();
    els.activitySubcategorySelect.value = activity.subcategory || "";
    els.activitySubjectDetail.value = activity.subjectDetail || "";
    els.activityFormat.value = activity.format;
    els.primaryArea.value = activity.primaryArea;
    updateSecondaryOptions();
    els.secondaryArea.value = activity.secondaryArea || "";
    els.activityTopic.value = activity.topic;
    els.activityMemo.value = activity.memo || "";
    updateCharacterCounts();
    renderActivityTable();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function clearActivityForm() {
    editingActivityId = null;
    els.activityForm.reset();
    els.submitActivityBtn.textContent = "활동 추가";
    els.cancelEditBtn.hidden = true;
    els.deleteActivityBtn.hidden = true;
    updateSubcategoryControl();
    updateSecondaryOptions();
    updateCharacterCounts();
    renderActivityTable();
  }

  function cancelActivityEdit() {
    clearActivityForm();
  }

  function deleteEditingActivity() {
    if (!editingActivityId) return;
    deleteActivity(editingActivityId);
  }

  function deleteActivity(id) {
    const activity = getActivity(id);
    if (!activity) return;
    if (!confirm("이 활동을 삭제할까? 마인드맵에 배치된 노드와 연결선도 함께 삭제된다.")) return;
    state.activities = state.activities.filter((item) => item.id !== id);
    const node = getActivityNode(id);
    if (node) {
      state.mindmap.nodes = state.mindmap.nodes.filter((item) => item.id !== node.id);
      removeEdgesForNode(node.id);
    }
    if (editingActivityId === id) clearActivityForm();
    if (selected.type === "node" && selected.id === node?.id) {
      selected = { type: null, id: null };
      connectStartId = null;
      groupMoveId = null;
    }
    renderAll();
    scheduleAutosave();
    showToast("활동을 삭제했다.");
  }

  function renderActivityTable() {
    const activities = getFilteredSortedActivities();
    els.activityTableBody.innerHTML = "";
    if (activities.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 9;
      td.className = "empty-row";
      td.textContent = "입력한 활동이 없다.";
      tr.appendChild(td);
      els.activityTableBody.appendChild(tr);
      return;
    }
    activities.forEach((activity) => {
      const tr = document.createElement("tr");
      tr.className = editingActivityId === activity.id ? "selected-row" : "";
      tr.tabIndex = 0;
      tr.title = "클릭하면 이 활동을 수정한다.";
      tr.innerHTML = `
        <td>${escapeHtml(activity.grade)}</td>
        <td>${escapeHtml(activity.category)}</td>
        <td>${escapeHtml(activity.subcategory || "")}</td>
        <td>${escapeHtml(activity.subjectDetail || "")}</td>
        <td><div class="clamp">${escapeHtml(activity.topic)}</div></td>
        <td><div class="clamp">${escapeHtml(activity.format)}</div></td>
        <td>${areaPill(activity.primaryArea)}</td>
        <td>${activity.secondaryArea ? areaPill(activity.secondaryArea) : ""}</td>
        <td><div class="clamp">${escapeHtml(activity.memo || "")}</div></td>
      `;
      tr.addEventListener("click", () => editActivity(activity.id));
      tr.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          editActivity(activity.id);
        }
      });
      els.activityTableBody.appendChild(tr);
    });
  }

  function getFilteredSortedActivities() {
    const query = activitySearchQuery;
    let activities = state.activities.filter((activity) => {
      if (!query) return true;
      return [activity.topic, activity.format, activity.memo].some((value) => normalize(value).includes(query));
    });
    const sort = els.activitySort.value;
    activities = activities.slice().sort((a, b) => {
      if (sort === "input") return a.createdAt - b.createdAt;
      if (sort === "grade") return byValue(a.grade, b.grade) || a.createdAt - b.createdAt;
      if (sort === "category") return categoryRank(a.category) - categoryRank(b.category) || a.createdAt - b.createdAt;
      if (sort === "subcategory") return byValue(a.subcategory, b.subcategory) || a.createdAt - b.createdAt;
      if (sort === "primaryArea") return byValue(a.primaryArea, b.primaryArea) || a.createdAt - b.createdAt;
      return 0;
    });
    return activities;
  }

  function renderSideActivityList() {
    const query = sideSearchQuery;
    const grade = els.sideGradeFilter.value;
    const placedFilter = els.sidePlacedFilter.value;
    const activities = state.activities.filter((activity) => {
      const placed = Boolean(getActivityNode(activity.id));
      if (grade !== "all" && activity.grade !== grade) return false;
      if (placedFilter === "placed" && !placed) return false;
      if (placedFilter === "unplaced" && placed) return false;
      if (!query) return true;
      return [activity.topic, activity.format, activity.memo].some((value) => normalize(value).includes(query));
    });
    els.sideActivityList.innerHTML = "";
    if (activities.length === 0) {
      const empty = document.createElement("div");
      empty.className = "detail-content empty";
      empty.textContent = "표시할 활동이 없다.";
      els.sideActivityList.appendChild(empty);
      return;
    }
    activities.forEach((activity) => {
      const placed = Boolean(getActivityNode(activity.id));
      const card = document.createElement("div");
      card.className = `activity-card${placed ? " placed" : ""}${pendingActivityId === activity.id ? " selected" : ""}`;
      card.draggable = !placed;
      card.innerHTML = `
        ${placed ? '<span class="check-mark">✓</span>' : ""}
        <div class="activity-card-title">${escapeHtml(activity.topic)}</div>
        <div class="activity-card-meta">${activity.grade} · ${escapeHtml(activity.category)}${activityPath(activity) ? ` · ${escapeHtml(activityPath(activity))}` : ""} · ${AREA_META[activity.primaryArea].short}</div>
      `;
      card.addEventListener("click", () => {
        if (placed) {
          const node = getActivityNode(activity.id);
          clearMindmapModes();
          selected = { type: "node", id: node.id };
          switchPanel("detail");
          renderMindmap();
          renderDetail();
          renderSideActivityList();
          return;
        }
        togglePlacementMode(activity.id);
        updatePlacementHint();
        renderSideActivityList();
        renderMindmap();
      });
      card.addEventListener("dragstart", (event) => {
        if (placed) return;
        clearMindmapModes();
        updatePlacementHint();
        renderMindmap();
        event.dataTransfer.setData("text/plain", activity.id);
        event.dataTransfer.effectAllowed = "copy";
      });
      els.sideActivityList.appendChild(card);
    });
  }

  function areaPill(area) {
    if (!area) return "";
    const meta = AREA_META[area];
    return `<span class="area-pill ${meta.cls}">${escapeHtml(area)}</span>`;
  }

  function renderMindmap() {
    if (connectStartId && !getNode(connectStartId)) connectStartId = null;
    if (groupMoveId && !getNode(groupMoveId)) groupMoveId = null;
    if (pendingActivityId && !getActivity(pendingActivityId)) pendingActivityId = null;
    const viewport = state.mindmap.viewport;
    els.viewportGroup.setAttribute("transform", `translate(${viewport.offsetX} ${viewport.offsetY}) scale(${viewport.scale})`);
    els.edgesGroup.innerHTML = "";
    els.edgeLabelsGroup.innerHTML = "";
    els.nodesGroup.innerHTML = "";

    state.mindmap.edges.forEach((edge) => renderEdge(edge));
    state.mindmap.nodes.forEach((node) => renderNode(node));
    updatePlacementHint();
    updateUndoButton();
  }

  function renderEdge(edge) {
    const from = getNode(edge.from);
    const to = getNode(edge.to);
    if (!from || !to) return;
    const p1 = nodeCenter(from);
    const p2 = nodeCenter(to);
    const dx = Math.abs(p2.x - p1.x);
    const curve = Math.max(60, dx * 0.35);
    const c1x = p1.x + (p2.x >= p1.x ? curve : -curve);
    const c2x = p2.x - (p2.x >= p1.x ? curve : -curve);
    const d = `M ${p1.x} ${p1.y} C ${c1x} ${p1.y}, ${c2x} ${p2.y}, ${p2.x} ${p2.y}`;
    const isSelected = selected.type === "edge" && selected.id === edge.id;

    const visible = document.createElementNS(SVG_NS, "path");
    visible.setAttribute("class", `edge-path${isSelected ? " selected" : ""}`);
    visible.setAttribute("d", d);
    els.edgesGroup.appendChild(visible);

    const hit = document.createElementNS(SVG_NS, "path");
    hit.setAttribute("class", "edge-hit");
    hit.setAttribute("d", d);
    hit.addEventListener("click", (event) => {
      event.stopPropagation();
      clearMindmapModes();
      selected = { type: "edge", id: edge.id };
      switchPanel("detail");
      renderMindmap();
      renderDetail();
    });
    els.edgesGroup.appendChild(hit);

    if (edge.label) {
      const mid = cubicPoint(p1, { x: c1x, y: p1.y }, { x: c2x, y: p2.y }, p2, 0.5);
      const fo = document.createElementNS(SVG_NS, "foreignObject");
      fo.setAttribute("class", "edge-label");
      fo.setAttribute("x", mid.x - 80);
      fo.setAttribute("y", mid.y - 16);
      fo.setAttribute("width", 160);
      fo.setAttribute("height", 42);
      const div = document.createElementNS(XHTML_NS, "div");
      div.textContent = edge.label;
      fo.appendChild(div);
      els.edgeLabelsGroup.appendChild(fo);
    }
  }

  function renderNode(node) {
    const dim = nodeDimensions(node);
    const fo = document.createElementNS(SVG_NS, "foreignObject");
    fo.setAttribute("class", `node-fo${connectStartId === node.id ? " connect-start" : ""}`);
    fo.setAttribute("x", node.x);
    fo.setAttribute("y", node.y);
    fo.setAttribute("width", dim.w);
    fo.setAttribute("height", dim.h);
    fo.dataset.nodeId = node.id;

    const div = document.createElementNS(XHTML_NS, "div");
    div.className = nodeClass(node);
    if (selected.type === "node" && selected.id === node.id) div.classList.add("selected");
    div.dataset.nodeId = node.id;
    div.innerHTML = nodeInnerHtml(node);
    div.addEventListener("pointerdown", (event) => onNodePointerDown(event, node.id));
    div.addEventListener("click", (event) => onNodeClick(event, node.id));

    div.querySelectorAll("[data-star]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleNodeStar(node.id, button.dataset.star);
      });
    });
    div.querySelectorAll("[data-node-action]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        handleNodeAction(node.id, button.dataset.nodeAction);
      });
    });

    fo.appendChild(div);
    els.nodesGroup.appendChild(fo);
  }

  function nodeClass(node) {
    if (node.type === "core") {
      return `node-card core ${AREA_META[node.area].cls}`;
    }
    if (node.type === "keyword") {
      return "node-card keyword";
    }
    const activity = getActivity(node.activityId);
    const cls = activity ? AREA_META[activity.primaryArea].cls : "";
    return `node-card activity ${cls}`;
  }

  function nodeInnerHtml(node) {
    if (node.type === "core") {
      return `
        <div class="core-label">${escapeHtml(node.label)}</div>
        <span class="node-actions core-actions">${nodeActionControls(node)}</span>
      `;
    }
    const stars = starMarks(node);
    const controls = nodeActionControls(node);
    if (node.type === "keyword") {
      return `
        <div class="node-topline">
          <span class="star-marks">${stars}</span>
          <span class="node-actions">${controls}</span>
        </div>
        <div class="node-title">${escapeHtml(node.title)}</div>
      `;
    }
    const activity = getActivity(node.activityId);
    if (!activity) return "";
    const dot = activity.secondaryArea ? `<span class="area-dot ${AREA_META[activity.secondaryArea].cls}" title="${escapeHtml(activity.secondaryArea)}"></span>` : "";
    return `
      <div class="node-topline">
        <span class="grade-badge">${activity.grade}</span>
        ${dot}
        <span class="star-marks">${stars}</span>
        <span class="node-actions">${controls}</span>
      </div>
      <div class="node-title">${escapeHtml(activity.topic)}</div>
    `;
  }

  function starMarks(node) {
    const solid = node.starSolid ? "⭐" : "";
    const outline = node.starOutline ? "♥️" : "";
    return `${solid}${outline}`;
  }

  function nodeActionControls(node) {
    const solid = node.starSolid ? " active" : "";
    const outline = node.starOutline ? " active" : "";
    const connect = connectStartId === node.id ? " active" : "";
    const group = groupMoveId === node.id ? " active" : "";
    const stars = node.type === "core" ? "" : `
      <button type="button" class="${solid.trim()}" data-star="solid" title="⭐로 표시">⭐</button>
      <button type="button" class="${outline.trim()}" data-star="outline" title="♥️로 표시">♥️</button>
    `;
    return `
      ${stars}
      <button type="button" class="${connect.trim()}" data-node-action="connect" title="이 노드에서 다른 노드로 연결">연결</button>
      <button type="button" class="${group.trim()}" data-node-action="group" title="연결된 노드를 함께 이동">묶음</button>
    `;
  }

  function nodeDimensions(node) {
    if (node.type === "core") return { w: 96, h: 96 };
    if (node.type === "keyword") {
      const len = textLength(node.title);
      const w = Math.round(clamp(166 + len * 1.8, 176, 220));
      const visibleLines = visibleNodeLines(len, w, 26, 14, 2);
      return { w, h: visibleLines > 1 ? 92 : 76 };
    }
    const activity = getActivity(node.activityId);
    const len = textLength(activity?.topic);
    const w = Math.round(clamp(166 + len, 180, 220));
    const visibleLines = visibleNodeLines(len, w, 28, 12, 3);
    return { w, h: 62 + visibleLines * 18 };
  }

  function selectNode(nodeId) {
    const node = getNode(nodeId);
    if (!node) return;
    selected = { type: "node", id: nodeId };
    if (groupMoveId && groupMoveId !== nodeId) groupMoveId = null;
    switchPanel("detail");
    renderDetail();
  }

  function clearMindmapSelection() {
    selected = { type: null, id: null };
    clearMindmapModes();
    renderMindmap();
    renderDetail();
  }

  function clearMindmapModes() {
    pendingActivityId = null;
    connectStartId = null;
    groupMoveId = null;
  }

  function togglePlacementMode(activityId) {
    const isActive = pendingActivityId === activityId;
    clearMindmapModes();
    if (!isActive) pendingActivityId = activityId;
  }

  function toggleConnectionMode(nodeId) {
    const isActive = connectStartId === nodeId;
    clearMindmapModes();
    if (!isActive) connectStartId = nodeId;
  }

  function toggleGroupMoveMode(nodeId) {
    const isActive = groupMoveId === nodeId;
    clearMindmapModes();
    if (!isActive) groupMoveId = nodeId;
  }

  function handleNodeAction(nodeId, action) {
    if (!getNode(nodeId)) return;
    selected = { type: "node", id: nodeId };
    switchPanel("detail");
    if (action === "connect") {
      toggleConnectionMode(nodeId);
      renderMindmap();
      renderDetail();
      updatePlacementHint();
      return;
    }
    if (action === "group") {
      toggleGroupMoveMode(nodeId);
      renderMindmap();
      renderDetail();
      updatePlacementHint();
    }
  }

  function onNodePointerDown(event, nodeId) {
    if (event.button !== 0 || event.target.closest("button")) return;
    event.stopPropagation();
    capturePointer(event.currentTarget, event);
    rememberPointer(event);
    if (startPinchIfPossible()) {
      event.preventDefault();
      return;
    }
    const node = getNode(nodeId);
    if (!node) return;
    if (connectStartId) return;
    if (pendingActivityId) {
      clearMindmapModes();
      updatePlacementHint();
      renderSideActivityList();
    }
    selectNode(nodeId);

    const world = clientToWorld(event.clientX, event.clientY);
    const movingIds = groupMoveId === nodeId ? connectedComponent(nodeId) : [nodeId];
    dragState = {
      pointerId: event.pointerId,
      start: world,
      startClientX: event.clientX,
      startClientY: event.clientY,
      ids: movingIds,
      before: cloneMindmap(),
      moved: false,
      original: movingIds.map((id) => {
        const item = getNode(id);
        return { id, x: item.x, y: item.y };
      })
    };
  }

  function onNodeClick(event, nodeId) {
    if (event.target.closest("button")) return;
    event.stopPropagation();
    if (Date.now() < suppressNodeClickUntil) return;
    if (connectStartId) {
      handleConnectClick(nodeId);
      return;
    }
    selectNode(nodeId);
    renderMindmap();
  }

  function handleConnectClick(nodeId) {
    if (!connectStartId) {
      clearMindmapModes();
      connectStartId = nodeId;
      selected = { type: "node", id: nodeId };
      switchPanel("detail");
      renderMindmap();
      renderDetail();
      return;
    }
    if (connectStartId === nodeId) {
      clearMindmapModes();
      selected = { type: null, id: null };
      showToast("연결을 취소했다.");
      renderMindmap();
      renderDetail();
      return;
    }
    const from = getNode(connectStartId);
    const to = getNode(nodeId);
    if (from?.type === "core" && to?.type === "core") {
      showToast("중심 노드끼리는 연결하지 않는다.");
      clearMindmapSelection();
      return;
    }
    if (edgeExists(connectStartId, nodeId)) {
      showToast("이미 연결된 노드다.");
      clearMindmapSelection();
      return;
    }
    pushUndo();
    state.mindmap.edges.push({ id: createId("edge"), from: connectStartId, to: nodeId, label: "" });
    clearMindmapModes();
    selected = { type: null, id: null };
    renderMindmap();
    renderDetail();
    scheduleAutosave();
  }

  function onSvgPointerDown(event) {
    const isBlank = event.target === els.mindmapSvg || event.target.classList.contains("canvas-bg");
    if (!isBlank) return;
    capturePointer(event.currentTarget, event);
    rememberPointer(event);
    if (startPinchIfPossible()) {
      event.preventDefault();
      return;
    }
    if (connectStartId) {
      clearMindmapSelection();
      return;
    }
    if (pendingActivityId) {
      const world = clientToWorld(event.clientX, event.clientY);
      placeActivityNode(pendingActivityId, world.x, world.y);
      return;
    }
    panState = {
      startX: event.clientX,
      startY: event.clientY,
      offsetX: state.mindmap.viewport.offsetX,
      offsetY: state.mindmap.viewport.offsetY,
      moved: false
    };
  }

  function onWindowPointerMove(event) {
    if (activePointers.has(event.pointerId)) {
      rememberPointer(event);
    }
    if (pinchState) {
      updatePinchZoom();
      return;
    }
    if (dragState) {
      const world = clientToWorld(event.clientX, event.clientY);
      const dx = world.x - dragState.start.x;
      const dy = world.y - dragState.start.y;
      const movedEnough = Math.abs(event.clientX - dragState.startClientX) > 4 || Math.abs(event.clientY - dragState.startClientY) > 4;
      if (!dragState.moved && !movedEnough) return;
      dragState.moved = true;
      dragState.original.forEach((item) => {
        const node = getNode(item.id);
        if (node) {
          node.x = item.x + dx;
          node.y = item.y + dy;
        }
      });
      renderMindmap();
      return;
    }
    if (panState) {
      const movedEnough = Math.abs(event.clientX - panState.startX) > 4 || Math.abs(event.clientY - panState.startY) > 4;
      if (!panState.moved && !movedEnough) return;
      panState.moved = true;
      state.mindmap.viewport.offsetX = panState.offsetX + event.clientX - panState.startX;
      state.mindmap.viewport.offsetY = panState.offsetY + event.clientY - panState.startY;
      renderMindmap();
    }
  }

  function onWindowPointerUp(event) {
    if (pinchState) {
      const isPinchPointer = pinchState.pointerIds.includes(event.pointerId);
      forgetPointer(event);
      if (isPinchPointer || activePointers.size < 2) finishPinchZoom();
      return;
    }
    if (dragState && event.pointerId !== dragState.pointerId) {
      forgetPointer(event);
      return;
    }
    if (dragState) {
      if (dragState.moved) {
        commitUndo(dragState.before);
        suppressNodeClickUntil = Date.now() + 250;
        scheduleAutosave();
      }
      dragState = null;
    }
    if (panState) {
      if (!panState.moved) {
        clearMindmapSelection();
      } else {
        suppressNodeClickUntil = Date.now() + 150;
        scheduleAutosave();
      }
      panState = null;
    }
    forgetPointer(event);
  }

  function capturePointer(target, event) {
    try {
      target.setPointerCapture?.(event.pointerId);
    } catch {
      // Some synthetic or cancelled pointer events cannot be captured.
    }
  }

  function rememberPointer(event) {
    activePointers.set(event.pointerId, {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY
    });
  }

  function forgetPointer(event) {
    activePointers.delete(event.pointerId);
  }

  function clearActivePointers() {
    activePointers.clear();
    pinchState = null;
    dragState = null;
    panState = null;
  }

  function startPinchIfPossible() {
    if (pinchState) return true;
    if (activePointers.size < 2) return false;
    const pointers = Array.from(activePointers.values()).slice(0, 2);
    const center = pointerCenter(pointers[0], pointers[1]);
    const distance = Math.max(1, pointerDistance(pointers[0], pointers[1]));
    cancelSinglePointerGestureForPinch();
    pinchState = {
      pointerIds: [pointers[0].id, pointers[1].id],
      startDistance: distance,
      startScale: state.mindmap.viewport.scale,
      centerWorld: clientToWorld(center.x, center.y),
      moved: false
    };
    return true;
  }

  function cancelSinglePointerGestureForPinch() {
    let shouldRender = false;
    if (dragState?.moved) {
      state.mindmap = dragState.before;
      shouldRender = true;
    }
    if (panState?.moved) {
      state.mindmap.viewport.offsetX = panState.offsetX;
      state.mindmap.viewport.offsetY = panState.offsetY;
      shouldRender = true;
    }
    dragState = null;
    panState = null;
    if (shouldRender) renderMindmap();
  }

  function updatePinchZoom() {
    const pointers = pinchState.pointerIds.map((id) => activePointers.get(id));
    if (pointers.some((pointer) => !pointer)) return;
    const [first, second] = pointers;
    const distance = Math.max(1, pointerDistance(first, second));
    const center = pointerCenter(first, second);
    const rect = els.mindmapSvg.getBoundingClientRect();
    const scale = clamp(pinchState.startScale * (distance / pinchState.startDistance), 0.35, 2.2);
    state.mindmap.viewport.scale = Number(scale.toFixed(3));
    state.mindmap.viewport.offsetX = center.x - rect.left - pinchState.centerWorld.x * state.mindmap.viewport.scale;
    state.mindmap.viewport.offsetY = center.y - rect.top - pinchState.centerWorld.y * state.mindmap.viewport.scale;
    pinchState.moved = true;
    renderMindmap();
  }

  function finishPinchZoom() {
    if (pinchState?.moved) {
      suppressNodeClickUntil = Date.now() + 250;
      scheduleAutosave();
    }
    pinchState = null;
  }

  function pointerDistance(first, second) {
    return Math.hypot(second.x - first.x, second.y - first.y);
  }

  function pointerCenter(first, second) {
    return {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2
    };
  }

  function onActivityDrop(event) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain");
    if (!id || getActivityNode(id)) return;
    const world = clientToWorld(event.clientX, event.clientY);
    placeActivityNode(id, world.x, world.y);
  }

  function placeActivityNode(activityId, x, y) {
    if (getActivityNode(activityId)) {
      showToast("이미 배치된 활동이다.");
      return;
    }
    const activity = getActivity(activityId);
    if (!activity) return;
    pushUndo();
    state.mindmap.nodes.push({
      id: createId("node"),
      type: "activity",
      activityId,
      x,
      y,
      starSolid: false,
      starOutline: false
    });
    clearMindmapModes();
    selected = { type: "node", id: state.mindmap.nodes[state.mindmap.nodes.length - 1].id };
    switchPanel("detail");
    renderSideActivityList();
    renderMindmap();
    renderDetail();
    scheduleAutosave();
  }

  function toggleNodeStar(nodeId, kind) {
    const node = getNode(nodeId);
    if (!node || node.type === "core") return;
    pushUndo();
    if (kind === "solid") node.starSolid = !node.starSolid;
    if (kind === "outline") node.starOutline = !node.starOutline;
    renderMindmap();
    renderDetail();
    scheduleAutosave();
  }

  function submitKeywordForm(event) {
    event.preventDefault();
    const title = els.keywordTitle.value.trim();
    const memo = els.keywordMemo.value.trim();
    if (!title) {
      showToast("키워드 제목을 입력해야 한다.");
      return;
    }
    const center = viewportCenterWorld();
    pushUndo();
    const node = {
      id: createId("key"),
      type: "keyword",
      title,
      memo,
      x: center.x - 105,
      y: center.y - 45,
      starSolid: false,
      starOutline: false
    };
    state.mindmap.nodes.push(node);
    selected = { type: "node", id: node.id };
    clearKeywordForm();
    switchPanel("detail");
    renderMindmap();
    renderDetail();
    scheduleAutosave();
  }

  function clearKeywordForm() {
    els.keywordForm.reset();
    els.keywordForm.hidden = true;
  }

  function renderDetail() {
    if (!selected.type) {
      els.detailContent.className = "detail-content empty";
      els.detailContent.textContent = "노드나 연결선을 선택하면 상세정보가 표시된다.";
      return;
    }
    if (selected.type === "edge") {
      renderEdgeDetail();
      return;
    }
    const node = getNode(selected.id);
    if (!node) {
      selected = { type: null, id: null };
      connectStartId = null;
      groupMoveId = null;
      renderDetail();
      return;
    }
    if (node.type === "core") renderCoreDetail(node);
    if (node.type === "activity") renderActivityNodeDetail(node);
    if (node.type === "keyword") renderKeywordDetail(node);
  }

  function renderActivityNodeDetail(node) {
    const activity = getActivity(node.activityId);
    if (!activity) return;
    els.detailContent.className = "detail-content";
    els.detailContent.innerHTML = `
      <h3 class="detail-title">${escapeHtml(activity.topic)}</h3>
      <dl class="detail-list">
        ${detailRow("학년", activity.grade)}
        ${detailRow("항목", activity.category)}
        ${detailRow("세부항목", activity.subcategory || "")}
        ${detailRow("과목명 추가", activity.subjectDetail || "")}
        ${detailRow("형식", activity.format)}
        ${detailRow("평가영역1", activity.primaryArea)}
        ${detailRow("평가영역2", activity.secondaryArea || "")}
        ${detailRow("메모", activity.memo || "")}
      </dl>
      <div class="detail-actions">
        <button type="button" id="removeActivityNodeBtn" class="danger ghost">마인드맵에서 제거</button>
      </div>
    `;
    document.getElementById("removeActivityNodeBtn").addEventListener("click", () => {
      pushUndo();
      state.mindmap.nodes = state.mindmap.nodes.filter((item) => item.id !== node.id);
      removeEdgesForNode(node.id);
      selected = { type: null, id: null };
      connectStartId = null;
      groupMoveId = null;
      renderAll();
      scheduleAutosave();
    });
  }

  function renderCoreDetail(node) {
    els.detailContent.className = "detail-content";
    els.detailContent.innerHTML = `
      <h3 class="detail-title">${escapeHtml(node.label)}</h3>
      <dl class="detail-list">
        ${detailRow("중심", `${node.label} 중심 노드`)}
      </dl>
      <div class="detail-actions">
        <button type="button" id="resetCorePositionBtn">위치 초기화</button>
      </div>
    `;
    document.getElementById("resetCorePositionBtn").addEventListener("click", () => {
      const original = CORE_NODES.find((item) => item.id === node.id);
      if (!original) return;
      pushUndo();
      node.x = original.x;
      node.y = original.y;
      renderMindmap();
      renderDetail();
      scheduleAutosave();
    });
  }

  function renderKeywordDetail(node) {
    els.detailContent.className = "detail-content";
    els.detailContent.innerHTML = `
      <h3 class="detail-title">${escapeHtml(node.title)}</h3>
      <dl class="detail-list">
        ${detailRow("종류", "키워드 노드")}
        ${detailRow("메모", node.memo || "")}
      </dl>
      <div class="detail-actions">
        <button type="button" id="editKeywordBtn">제목/메모 수정</button>
        <button type="button" id="deleteKeywordBtn" class="danger ghost">키워드 삭제</button>
      </div>
    `;
    document.getElementById("editKeywordBtn").addEventListener("click", () => renderKeywordEditForm(node));
    document.getElementById("deleteKeywordBtn").addEventListener("click", () => {
      if (!confirm("이 키워드 노드를 삭제할까? 연결된 선도 함께 삭제된다.")) return;
      pushUndo();
      state.mindmap.nodes = state.mindmap.nodes.filter((item) => item.id !== node.id);
      removeEdgesForNode(node.id);
      selected = { type: null, id: null };
      connectStartId = null;
      groupMoveId = null;
      renderAll();
      scheduleAutosave();
    });
  }

  function renderKeywordEditForm(node) {
    els.detailContent.innerHTML = `
      <form id="keywordEditForm" class="detail-form">
        <label>제목 <input id="keywordEditTitle" type="text" value="${escapeAttribute(node.title)}"></label>
        <label>메모 <textarea id="keywordEditMemo" rows="4">${escapeHtml(node.memo || "")}</textarea></label>
        <div class="detail-actions">
          <button type="submit" class="primary">저장</button>
          <button type="button" id="cancelKeywordEditBtn" class="ghost">취소</button>
        </div>
      </form>
    `;
    document.getElementById("keywordEditForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const title = document.getElementById("keywordEditTitle").value.trim();
      const memo = document.getElementById("keywordEditMemo").value.trim();
      if (!title) {
        showToast("키워드 제목을 입력해야 한다.");
        return;
      }
      pushUndo();
      node.title = title;
      node.memo = memo;
      renderMindmap();
      renderDetail();
      scheduleAutosave();
    });
    document.getElementById("cancelKeywordEditBtn").addEventListener("click", () => renderKeywordDetail(node));
  }

  function renderEdgeDetail() {
    const edge = getEdge(selected.id);
    if (!edge) {
      selected = { type: null, id: null };
      connectStartId = null;
      groupMoveId = null;
      renderDetail();
      return;
    }
    const fromLabel = nodeLabel(getNode(edge.from));
    const toLabel = nodeLabel(getNode(edge.to));
    els.detailContent.className = "detail-content";
    els.detailContent.innerHTML = `
      <h3 class="detail-title">연결</h3>
      <dl class="detail-list">
        ${detailRow("시작", fromLabel)}
        ${detailRow("끝", toLabel)}
      </dl>
      <form id="edgeEditForm" class="detail-form">
        <label>설명 <textarea id="edgeLabelInput" rows="3" placeholder="선택 입력">${escapeHtml(edge.label || "")}</textarea></label>
        <div class="detail-actions">
          <button type="submit" class="primary">설명 저장</button>
          <button type="button" id="deleteEdgeBtn" class="danger ghost">연결 삭제</button>
        </div>
      </form>
    `;
    document.getElementById("edgeEditForm").addEventListener("submit", (event) => {
      event.preventDefault();
      pushUndo();
      edge.label = document.getElementById("edgeLabelInput").value.trim();
      renderMindmap();
      renderDetail();
      scheduleAutosave();
    });
    document.getElementById("deleteEdgeBtn").addEventListener("click", () => {
      pushUndo();
      state.mindmap.edges = state.mindmap.edges.filter((item) => item.id !== edge.id);
      selected = { type: null, id: null };
      connectStartId = null;
      groupMoveId = null;
      renderMindmap();
      renderDetail();
      scheduleAutosave();
    });
  }

  function detailRow(label, value) {
    return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "-")}</dd></div>`;
  }

  function pushUndo() {
    commitUndo(cloneMindmap());
  }

  function commitUndo(snapshot) {
    undoStack.push(snapshot);
    if (undoStack.length > 80) undoStack.shift();
    updateUndoButton();
  }

  function undoMindmap() {
    const snapshot = undoStack.pop();
    if (!snapshot) return;
    state.mindmap = snapshot;
    selected = { type: null, id: null };
    connectStartId = null;
    groupMoveId = null;
    pendingActivityId = null;
    syncInputsFromState();
    renderSideActivityList();
    renderMindmap();
    renderDetail();
    scheduleAutosave();
  }

  function updateUndoButton() {
    els.undoBtn.disabled = undoStack.length === 0;
  }

  function cloneMindmap() {
    return JSON.parse(JSON.stringify(state.mindmap));
  }

  function setZoom(value) {
    state.mindmap.viewport.scale = clamp(Number(value.toFixed(2)), 0.35, 2.2);
    renderMindmap();
    scheduleAutosave();
  }

  function fitView() {
    const bbox = nodesBoundingBox(state.mindmap.nodes);
    const rect = els.mindmapSvg.getBoundingClientRect();
    const padding = 70;
    const scale = Math.min(
      (rect.width - padding * 2) / Math.max(1, bbox.w),
      (rect.height - padding * 2) / Math.max(1, bbox.h),
      1.4
    );
    state.mindmap.viewport.scale = clamp(scale, 0.35, 1.4);
    state.mindmap.viewport.offsetX = padding - bbox.x * state.mindmap.viewport.scale;
    state.mindmap.viewport.offsetY = padding - bbox.y * state.mindmap.viewport.scale;
    renderMindmap();
    scheduleAutosave();
  }

  function clientToWorld(clientX, clientY) {
    const rect = els.mindmapSvg.getBoundingClientRect();
    const viewport = state.mindmap.viewport;
    return {
      x: (clientX - rect.left - viewport.offsetX) / viewport.scale,
      y: (clientY - rect.top - viewport.offsetY) / viewport.scale
    };
  }

  function viewportCenterWorld() {
    const rect = els.mindmapSvg.getBoundingClientRect();
    const viewport = state.mindmap.viewport;
    return {
      x: (rect.width / 2 - viewport.offsetX) / viewport.scale,
      y: (rect.height / 2 - viewport.offsetY) / viewport.scale
    };
  }

  function updatePlacementHint() {
    if (connectStartId) {
      const node = getNode(connectStartId);
      els.placementHint.textContent = node ? `${nodeLabel(node)}에서 연결할 노드를 선택한다. 빈 공간을 누르면 취소된다.` : "";
      els.placementHint.hidden = !node;
      return;
    }
    if (!pendingActivityId) {
      els.placementHint.hidden = true;
      return;
    }
    const activity = getActivity(pendingActivityId);
    els.placementHint.textContent = activity ? "캔버스의 빈 곳을 누르면 활동 노드가 배치된다." : "";
    els.placementHint.hidden = !activity;
  }

  function connectedComponent(startId) {
    const seen = new Set([startId]);
    const queue = [startId];
    while (queue.length) {
      const id = queue.shift();
      state.mindmap.edges.forEach((edge) => {
        const next = edge.from === id ? edge.to : edge.to === id ? edge.from : null;
        if (next && !seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      });
    }
    return Array.from(seen);
  }

  function edgeExists(a, b) {
    return state.mindmap.edges.some((edge) => {
      return (edge.from === a && edge.to === b) || (edge.from === b && edge.to === a);
    });
  }

  function removeEdgesForNode(nodeId) {
    state.mindmap.edges = state.mindmap.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId);
  }

  function getActivity(id) {
    return state.activities.find((activity) => activity.id === id);
  }

  function getActivityNode(activityId) {
    return state.mindmap.nodes.find((node) => node.type === "activity" && node.activityId === activityId);
  }

  function getNode(id) {
    return state.mindmap.nodes.find((node) => node.id === id);
  }

  function getEdge(id) {
    return state.mindmap.edges.find((edge) => edge.id === id);
  }

  function nodeCenter(node) {
    const dim = nodeDimensions(node);
    return { x: node.x + dim.w / 2, y: node.y + dim.h / 2 };
  }

  function nodeLabel(node) {
    if (!node) return "";
    if (node.type === "core") return node.label;
    if (node.type === "keyword") return node.title;
    const activity = getActivity(node.activityId);
    return activity ? activity.topic : "";
  }

  function nodesBoundingBox(nodes) {
    if (!nodes.length) return { x: 0, y: 0, w: 1000, h: 600 };
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    nodes.forEach((node) => {
      const dim = nodeDimensions(node);
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + dim.w);
      maxY = Math.max(maxY, node.y + dim.h);
    });
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  function saveProject() {
    state.student.number = els.studentNumber.value.trim();
    state.student.name = els.studentName.value.trim();
    if (!state.student.number || !state.student.name) {
      showToast("프로젝트 저장에는 학번과 이름이 필요하다.");
      return;
    }
    const content = JSON.stringify(state, null, 2);
    const filename = `mm_${safeFilename(`${state.student.number}${state.student.name}`)}${compactTimestamp()}.json`;
    downloadText(filename, content, "application/json;charset=utf-8");
    setSaveStatus("프로젝트 파일 저장됨");
    scheduleAutosave();
  }

  function requestProjectLoad() {
    if (hasAnyWork()) {
      const proceed = confirm("현재 작업이 바뀐다. 저장하지 않았다면 먼저 프로젝트 저장을 누르자. 계속 불러올까?");
      if (!proceed) return;
    }
    els.projectFileInput.value = "";
    els.projectFileInput.click();
  }

  function loadProjectFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = normalizeLoadedState(JSON.parse(reader.result));
        state = next;
        undoStack = [];
        selected = { type: null, id: null };
        pendingActivityId = null;
        connectStartId = null;
        groupMoveId = null;
        resetActivitySearch();
        resetSideSearch();
        clearActivityForm();
        renderAll();
        scheduleAutosave();
        setSaveStatus("프로젝트를 불러왔다.");
      } catch (error) {
        console.error(error);
        showToast("프로젝트 파일을 불러오지 못했다.");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function resetProject() {
    if (!confirm("현재 작업과 자동저장을 모두 지울까?")) return;
    state = createDefaultState();
    undoStack = [];
    selected = { type: null, id: null };
    pendingActivityId = null;
    connectStartId = null;
    groupMoveId = null;
    editingActivityId = null;
    resetActivitySearch();
    resetSideSearch();
    localStorage.removeItem(AUTOSAVE_KEY);
    clearActivityForm();
    renderAll();
    setSaveStatus("초기화했다.");
  }

  function normalizeLoadedState(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const base = createDefaultState();
    const next = { ...base, ...source };
    next.version = PROJECT_VERSION;
    next.student = { ...base.student, ...(source.student || {}) };
    next.counters = { ...base.counters, ...(source.counters || {}) };
    next.activities = Array.isArray(source.activities) ? source.activities.map(normalizeActivity) : [];
    next.mindmap = { ...base.mindmap, ...(source.mindmap || {}) };
    next.mindmap.nodes = Array.isArray(next.mindmap.nodes) ? next.mindmap.nodes : base.mindmap.nodes;
    next.mindmap.edges = Array.isArray(next.mindmap.edges) ? next.mindmap.edges : [];
    next.mindmap.starLabels = { ...base.mindmap.starLabels, ...(next.mindmap.starLabels || {}) };
    next.mindmap.viewport = { ...base.mindmap.viewport, ...(next.mindmap.viewport || {}) };
    sanitizeLoadedMindmap(next);
    return next;
  }

  function normalizeActivity(activity) {
    const next = { subjectDetail: "", ...activity };
    if (next.category === "교과") {
      next.category = "교과세특";
      if (!COURSE_SUBCATEGORIES.includes(next.subcategory || "")) {
        next.subjectDetail = next.subjectDetail || next.subcategory || "";
        next.subcategory = "";
      }
    }
    if ((next.category === "출결" || next.category === "행발") && !next.subcategory) {
      next.subcategory = "없음";
    }
    if (!isCourseCategory(next.category)) {
      next.subjectDetail = "";
    }
    if (!AREAS.includes(next.primaryArea)) {
      next.primaryArea = AREAS[0];
    }
    if (next.secondaryArea && (!AREAS.includes(next.secondaryArea) || next.secondaryArea === next.primaryArea)) {
      next.secondaryArea = "";
    }
    return next;
  }

  function sanitizeLoadedMindmap(target) {
    const activityIds = new Set(target.activities.map((activity) => activity.id).filter(Boolean));
    const sourceNodes = Array.isArray(target.mindmap.nodes) ? target.mindmap.nodes : [];
    const sourceById = new Map(sourceNodes.filter((node) => node?.id).map((node) => [node.id, node]));
    const nodes = CORE_NODES.map((core) => {
      const saved = sourceById.get(core.id);
      return {
        ...core,
        x: finiteNumber(saved?.x, core.x),
        y: finiteNumber(saved?.y, core.y)
      };
    });
    const nodeIds = new Set(nodes.map((node) => node.id));
    const placedActivityIds = new Set();

    sourceNodes.forEach((node) => {
      if (!node || typeof node !== "object" || node.type === "core") return;
      const id = String(node.id || "").trim();
      if (!id || nodeIds.has(id)) return;
      if (node.type === "activity") {
        const activityId = String(node.activityId || "").trim();
        if (!activityIds.has(activityId) || placedActivityIds.has(activityId)) return;
        nodes.push({
          id,
          type: "activity",
          activityId,
          x: finiteNumber(node.x, 260),
          y: finiteNumber(node.y, 260),
          starSolid: Boolean(node.starSolid),
          starOutline: Boolean(node.starOutline)
        });
        nodeIds.add(id);
        placedActivityIds.add(activityId);
        return;
      }
      if (node.type === "keyword") {
        nodes.push({
          id,
          type: "keyword",
          title: String(node.title || "").trim() || "키워드",
          memo: String(node.memo || ""),
          x: finiteNumber(node.x, 360),
          y: finiteNumber(node.y, 260),
          starSolid: Boolean(node.starSolid),
          starOutline: Boolean(node.starOutline)
        });
        nodeIds.add(id);
      }
    });

    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const edgeIds = new Set();
    const edgePairs = new Set();
    target.mindmap.nodes = nodes;
    target.mindmap.edges = target.mindmap.edges.flatMap((edge) => {
      if (!edge || typeof edge !== "object") return [];
      const from = String(edge.from || "").trim();
      const to = String(edge.to || "").trim();
      if (!from || !to || from === to || !nodesById.has(from) || !nodesById.has(to)) return [];
      const fromNode = nodesById.get(from);
      const toNode = nodesById.get(to);
      if (fromNode.type === "core" && toNode.type === "core") return [];
      const pairKey = [from, to].sort().join("::");
      if (edgePairs.has(pairKey)) return [];
      edgePairs.add(pairKey);
      let id = String(edge.id || "").trim();
      if (!id || edgeIds.has(id)) id = createId("edge");
      edgeIds.add(id);
      return [{ id, from, to, label: String(edge.label || "").trim() }];
    });
  }

  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      const savedAt = new Date().toISOString();
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ savedAt, state }));
      setSaveStatus(`브라우저에 임시저장됨 ${formatClock(savedAt)}`);
    }, 250);
  }

  function showAutosavePromptIfNeeded() {
    const autosave = readAutosave();
    if (!autosave) return;
    if (hasAnyWork(autosave.state)) {
      els.autosaveInfo.textContent = autosaveSummary(autosave);
      els.autosaveBanner.hidden = false;
    }
  }

  function restoreAutosave() {
    const autosave = readAutosave();
    if (!autosave) return;
    try {
      state = normalizeLoadedState(autosave.state);
      undoStack = [];
      selected = { type: null, id: null };
      pendingActivityId = null;
      connectStartId = null;
      groupMoveId = null;
      resetActivitySearch();
      resetSideSearch();
      clearActivityForm();
      renderAll();
      els.autosaveBanner.hidden = true;
      setSaveStatus("자동저장을 복구했다.");
    } catch {
      showToast("자동저장을 복구하지 못했다.");
    }
  }

  function readAutosave() {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved);
      if (parsed?.state) {
        return { savedAt: parsed.savedAt || "", state: parsed.state };
      }
      return { savedAt: parsed?.savedAt || "", state: parsed };
    } catch {
      localStorage.removeItem(AUTOSAVE_KEY);
      return null;
    }
  }

  function autosaveSummary(autosave) {
    const student = autosave.state?.student || {};
    const who = [student.number, student.name].map((value) => String(value || "").trim()).filter(Boolean).join(" ");
    const when = autosave.savedAt ? `브라우저에 임시저장됨 ${formatSavedAt(autosave.savedAt)}` : "브라우저 임시저장";
    return [who || "학번/이름 없음", when].filter(Boolean).join(" · ");
  }

  function hasAnyWork(target = state) {
    return Boolean(
      target.student?.number ||
      target.student?.name ||
      target.activities?.length ||
      target.mindmap?.nodes?.some((node) => node.type !== "core") ||
      target.mindmap?.edges?.length
    );
  }

  function copyActivityTable() {
    const tsv = buildActivityTsv();
    copyText(tsv).then(() => showToast("표를 복사했다."));
  }

  function saveActivityTsv() {
    state.student.number = els.studentNumber.value.trim();
    state.student.name = els.studentName.value.trim();
    const number = state.student.number || "학번";
    const name = state.student.name || "이름";
    downloadText(`활동표_${safeFilename(number)}_${safeFilename(name)}.tsv`, "\ufeff" + buildActivityTsv(), "text/tab-separated-values;charset=utf-8");
  }

  function buildActivityTsv() {
    const headers = ["학년", "항목", "세부항목", "과목명 추가", "활동주제", "형식", "평가영역1", "평가영역2", "메모"];
    const rows = state.activities.map((activity) => [
      activity.grade,
      activity.category,
      activity.subcategory || "",
      activity.subjectDetail || "",
      activity.topic,
      activity.format,
      activity.primaryArea,
      activity.secondaryArea || "",
      activity.memo || ""
    ]);
    return [headers, ...rows].map((row) => row.map(tsvCell).join("\t")).join("\n");
  }

  function printActivityTable() {
    const rows = state.activities.map((activity) => `
      <tr>
        <td>${escapeHtml(activity.grade)}</td>
        <td>${escapeHtml(activity.category)}</td>
        <td>${escapeHtml(activity.subcategory || "")}</td>
        <td>${escapeHtml(activity.subjectDetail || "")}</td>
        <td>${escapeHtml(activity.topic)}</td>
        <td>${escapeHtml(activity.format)}</td>
        <td>${escapeHtml(activity.primaryArea)}</td>
        <td>${escapeHtml(activity.secondaryArea || "")}</td>
        <td>${escapeHtml(activity.memo || "")}</td>
      </tr>
    `).join("");
    const html = printShell(`
      ${printHeader("활동 입력표")}
      <table class="print-table">
        <thead><tr><th>학년</th><th>항목</th><th>세부항목</th><th>과목명 추가</th><th>활동주제</th><th>형식</th><th>평가영역1</th><th>평가영역2</th><th>메모</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="9">입력한 활동이 없다.</td></tr>'}</tbody>
      </table>
    `, "portrait");
    openPrintWindow(html);
  }

  function printSelectedMindmap() {
    const value = els.printModeSelect.value;
    if (value === "full" || value === "current") {
      printMindmap(value);
      return;
    }
    if (value.startsWith("area:")) {
      printMindmap("area", value.slice(5));
    }
  }

  function printMindmap(mode, areaId) {
    const selection = getPrintSelection(mode, areaId);
    if (selection.nodes.length === 0) {
      showToast("출력할 노드가 없다.");
      return;
    }
    const svg = buildPrintSvg(selection.nodes, selection.edges, selection.viewBox);
    const title = mode === "area" ? `${nodeLabel(getNode(areaId))} 마인드맵` : "생기부 마인드맵";
    const html = printShell(`
      <main class="print-page map-page">
        ${printHeader(title)}
        <div class="map-print-wrap">${svg}</div>
      </main>
    `, "landscape");
    openPrintWindow(html);
  }

  function getPrintSelection(mode, areaId) {
    if (mode === "current") {
      const rect = els.mindmapSvg.getBoundingClientRect();
      const viewport = state.mindmap.viewport;
      const viewBox = {
        x: -viewport.offsetX / viewport.scale,
        y: -viewport.offsetY / viewport.scale,
        w: rect.width / viewport.scale,
        h: rect.height / viewport.scale
      };
      return { nodes: state.mindmap.nodes, edges: state.mindmap.edges, viewBox };
    }
    if (mode === "area") {
      const ids = new Set([areaId]);
      state.mindmap.edges.forEach((edge) => {
        if (edge.from === areaId) ids.add(edge.to);
        if (edge.to === areaId) ids.add(edge.from);
      });
      const nodes = state.mindmap.nodes.filter((node) => ids.has(node.id));
      const edges = state.mindmap.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to));
      return { nodes, edges, viewBox: paddedViewBox(nodes) };
    }
    return { nodes: state.mindmap.nodes, edges: state.mindmap.edges, viewBox: paddedViewBox(state.mindmap.nodes) };
  }

  function paddedViewBox(nodes) {
    const bbox = nodesBoundingBox(nodes);
    const pad = 90;
    return { x: bbox.x - pad, y: bbox.y - pad, w: bbox.w + pad * 2, h: bbox.h + pad * 2 };
  }

  function buildPrintSvg(nodes, edges, viewBox) {
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edgeMarkup = edges
      .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to))
      .map((edge) => printEdgeMarkup(edge))
      .join("");
    const labelMarkup = edges
      .filter((edge) => edge.label && nodeIds.has(edge.from) && nodeIds.has(edge.to))
      .map((edge) => printEdgeLabelMarkup(edge))
      .join("");
    const nodeMarkup = nodes.map((node) => printNodeMarkup(node)).join("");
    return `
      <svg class="print-map" viewBox="${viewBox.x} ${viewBox.y} ${Math.max(1, viewBox.w)} ${Math.max(1, viewBox.h)}" xmlns="${SVG_NS}">
        <rect x="${viewBox.x}" y="${viewBox.y}" width="${viewBox.w}" height="${viewBox.h}" fill="#fbfcfa"/>
        ${edgeMarkup}
        ${labelMarkup}
        ${nodeMarkup}
      </svg>
    `;
  }

  function printEdgeMarkup(edge) {
    const from = getNode(edge.from);
    const to = getNode(edge.to);
    if (!from || !to) return "";
    const p1 = nodeCenter(from);
    const p2 = nodeCenter(to);
    const dx = Math.abs(p2.x - p1.x);
    const curve = Math.max(60, dx * 0.35);
    const c1x = p1.x + (p2.x >= p1.x ? curve : -curve);
    const c2x = p2.x - (p2.x >= p1.x ? curve : -curve);
    return `<path d="M ${p1.x} ${p1.y} C ${c1x} ${p1.y}, ${c2x} ${p2.y}, ${p2.x} ${p2.y}" fill="none" stroke="#8e9789" stroke-width="2.2" stroke-linecap="round"/>`;
  }

  function printEdgeLabelMarkup(edge) {
    const from = getNode(edge.from);
    const to = getNode(edge.to);
    if (!from || !to) return "";
    const p1 = nodeCenter(from);
    const p2 = nodeCenter(to);
    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    return `<text x="${mid.x}" y="${mid.y - 8}" text-anchor="middle" font-size="13" fill="#444b41">${escapeHtml(edge.label)}</text>`;
  }

  function printNodeMarkup(node) {
    const dim = nodeDimensions(node);
    if (node.type === "core") {
      const meta = AREA_META[node.area];
      return `
        <circle cx="${node.x + dim.w / 2}" cy="${node.y + dim.h / 2}" r="${dim.w / 2}" fill="${meta.bg}" stroke="${meta.color}" stroke-width="3"/>
        <text x="${node.x + dim.w / 2}" y="${node.y + dim.h / 2 + 7}" text-anchor="middle" font-size="22" font-weight="700" fill="#242623">${escapeHtml(node.label)}</text>
      `;
    }
    const activity = node.type === "activity" ? getActivity(node.activityId) : null;
    const fill = node.type === "keyword" ? "#eeeeea" : AREA_META[activity.primaryArea].bg;
    const stroke = node.type === "keyword" ? "#9da39a" : AREA_META[activity.primaryArea].color;
    const title = node.type === "keyword" ? node.title : activity.topic;
    const top = node.type === "activity" ? activity.grade : "키워드";
    const dot = node.type === "activity" && activity.secondaryArea ? `<circle cx="${node.x + 58}" cy="${node.y + 19}" r="6" fill="${AREA_META[activity.secondaryArea].color}" stroke="#666" stroke-width="1"/>` : "";
    const stars = `${node.starSolid ? "⭐" : ""}${node.starOutline ? "♥️" : ""}`;
    const charsPerLine = Math.max(8, Math.floor((dim.w - 26) / 12));
    const lines = wrapText(title, charsPerLine, node.type === "activity" ? 3 : 2);
    const textLines = lines.map((line, index) => `<text x="${node.x + 12}" y="${node.y + 50 + index * 18}" font-size="14" font-weight="700" fill="#242623">${escapeHtml(line)}</text>`).join("");
    return `
      <rect x="${node.x}" y="${node.y}" width="${dim.w}" height="${dim.h}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <rect x="${node.x + 10}" y="${node.y + 9}" width="${node.type === "activity" ? 42 : 54}" height="22" rx="11" fill="rgba(255,255,255,0.78)" stroke="#b8bfb5"/>
      <text x="${node.x + 31}" y="${node.y + 25}" text-anchor="middle" font-size="12" font-weight="700" fill="#242623">${escapeHtml(top)}</text>
      ${dot}
      <text x="${node.x + dim.w - 14}" y="${node.y + 27}" text-anchor="end" font-size="18" fill="#242623">${escapeHtml(stars)}</text>
      ${textLines}
    `;
  }

  function printHeader(title) {
    const date = new Date();
    const dateText = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
    return `
      <header class="print-header">
        <div>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(state.student.number || "")} ${escapeHtml(state.student.name || "")}</p>
        </div>
        <div class="print-meta">
          <p>⭐ ${escapeHtml(state.mindmap.starLabels.solid || "")}</p>
          <p>♥️ ${escapeHtml(state.mindmap.starLabels.outline || "")}</p>
          <p>출력일: ${dateText}</p>
        </div>
      </header>
    `;
  }

  function printShell(content, orientation) {
    return `<!doctype html>
      <html lang="ko">
      <head>
        <meta charset="utf-8">
        <title>출력</title>
        <style>
          @page { size: A4 ${orientation}; margin: 8mm; }
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; }
          body { font-family: "Malgun Gothic", "Apple SD Gothic Neo", system-ui, sans-serif; color: #242623; }
          .print-page { break-inside: avoid; page-break-inside: avoid; overflow: hidden; }
          .map-page { height: 194mm; display: flex; flex-direction: column; }
          .print-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 10px; border-bottom: 1px solid #d9ded6; padding-bottom: 8px; }
          .print-header h1 { margin: 0 0 4px; font-size: 20px; }
          .print-header p { margin: 0; font-size: 12px; }
          .print-meta { text-align: right; display: grid; gap: 3px; }
          .map-print-wrap { width: 100%; flex: 1 1 auto; min-height: 0; border: 1px solid #d9ded6; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
          .print-map { width: 100%; height: 100%; display: block; }
          .print-table { width: 100%; border-collapse: collapse; font-size: 11px; }
          .print-table th, .print-table td { border: 1px solid #cfd5cb; padding: 5px; vertical-align: top; text-align: left; word-break: break-word; }
          .print-table th { background: #f0f2ee; }
        </style>
      </head>
      <body>${content}</body>
      </html>`;
  }

  function openPrintWindow(html) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showToast("팝업이 차단되어 출력 창을 열지 못했다.");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  }

  function downloadText(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function copyText(text) {
    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    }
    return fallbackCopy(text);
  }

  function fallbackCopy(text) {
    return new Promise((resolve) => {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
      resolve();
    });
  }

  function formatClock(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  function formatSavedAt(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${pad2(date.getMonth() + 1)}.${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  function compactTimestamp(date = new Date()) {
    return `${pad2(date.getMonth() + 1)}${pad2(date.getDate())}${pad2(date.getHours())}${pad2(date.getMinutes())}`;
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function normalize(value) {
    return String(value || "").trim().toLocaleLowerCase("ko-KR");
  }

  function byValue(a, b) {
    return String(a || "").localeCompare(String(b || ""), "ko-KR");
  }

  function isCourseCategory(category) {
    return category === "교과성적" || category === "교과세특";
  }

  function categoryRank(category) {
    const index = CATEGORY_ORDER.indexOf(category);
    return index === -1 ? CATEGORY_ORDER.length : index;
  }

  function activityPath(activity) {
    if (!activity?.subcategory) return "";
    if (activity.subjectDetail) return `${activity.subcategory} / ${activity.subjectDetail}`;
    return activity.subcategory;
  }

  function tsvCell(value) {
    return String(value || "").replace(/\t/g, " ").replace(/\r?\n/g, " ");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  function safeFilename(value) {
    return String(value || "").trim().replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_") || "untitled";
  }

  function createId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function textLength(value) {
    return Array.from(String(value || "").trim()).length;
  }

  function visibleNodeLines(length, width, padding, charWidth, maxLines) {
    if (!length) return 1;
    const charsPerLine = Math.max(8, Math.floor((width - padding) / charWidth));
    return Math.min(maxLines, Math.max(1, Math.ceil(length / charsPerLine)));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function finiteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function cubicPoint(p0, p1, p2, p3, t) {
    const mt = 1 - t;
    return {
      x: mt ** 3 * p0.x + 3 * mt ** 2 * t * p1.x + 3 * mt * t ** 2 * p2.x + t ** 3 * p3.x,
      y: mt ** 3 * p0.y + 3 * mt ** 2 * t * p1.y + 3 * mt * t ** 2 * p2.y + t ** 3 * p3.y
    };
  }

  function wrapText(text, maxChars, maxLines) {
    const clean = String(text || "").trim();
    if (!clean) return [""];
    const chunks = [];
    let line = "";
    clean.split(/\s+/).forEach((word) => {
      if ((line + " " + word).trim().length <= maxChars) {
        line = (line + " " + word).trim();
      } else {
        if (line) chunks.push(line);
        if (word.length > maxChars) {
          for (let i = 0; i < word.length; i += maxChars) chunks.push(word.slice(i, i + maxChars));
          line = "";
        } else {
          line = word;
        }
      }
    });
    if (line) chunks.push(line);
    return chunks.slice(0, maxLines);
  }

  function setSaveStatus(text) {
    els.saveStatus.textContent = text;
  }

  function showToast(message, duration = 2200) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.hidden = false;
    toastTimer = setTimeout(() => {
      els.toast.hidden = true;
    }, duration);
  }
})();

// The sky at key moments of the day. Everything in between is blended.
// Dawn and dusk change fast so that the text stays readable for almost all the day.
const SKY = [
  { minute: 0, top: "#0b1026", bottom: "#1a2144" },
  { minute: 350, top: "#1c2048", bottom: "#3f3f6e" },
  { minute: 370, top: "#3b4474", bottom: "#7a6284" },
  { minute: 380, top: "#8fa9cf", bottom: "#efb9a2" },
  { minute: 420, top: "#a6c3e0", bottom: "#f7d3bd" },
  { minute: 540, top: "#a9d3ee", bottom: "#e4f1f7" },
  { minute: 780, top: "#8cc4ec", bottom: "#d3eaf7" },
  { minute: 1050, top: "#b3c6dd", bottom: "#f6c58a" },
  { minute: 1160, top: "#8f9cc4", bottom: "#ee9f7a" },
  { minute: 1175, top: "#3a3670", bottom: "#8f4a68" },
  { minute: 1260, top: "#1d2150", bottom: "#3a3468" },
  { minute: 1440, top: "#0b1026", bottom: "#1a2144" },
];

const day = document.getElementById("day");
const clock = document.getElementById("clock");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function toMinute(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

const sameText = (text) => text.trim().toLowerCase();

function clone(templateId) {
  return document.getElementById(templateId).content.firstElementChild.cloneNode(true);
}

function setTime(element, time) {
  element.textContent = time;
  element.dateTime = time;
}

function renderMoment({ time, text }) {
  const row = clone("moment-template");
  setTime(row.querySelector("time"), time);
  row.querySelector("span").textContent = text;
  row.dataset.minute = toMinute(time);
  return row;
}

function renderProject(project) {
  const article = clone("project-template");
  const video = article.querySelector(".film");
  const prototype = article.querySelector(".prototype");
  const shots = article.querySelector(".shots");

  article.id = project.id;
  article.dataset.minute = toMinute(project.time);
  setTime(article.querySelector("time"), project.time);
  article.querySelector("h2").textContent = project.moment;
  article.querySelector(".title").textContent = project.title;
  article.querySelector(".short").textContent = project.short;
  article.querySelector(".long").textContent = project.long;
  article.querySelector(".group").textContent = project.names;
  article.querySelectorAll("[data-field]").forEach((field) => {
    const text = project[field.dataset.field];
    if (text) field.textContent = text;
    else {
      field.previousElementSibling.remove();
      field.remove();
    }
  });

  if (project.video) {
    video.src = project.video;
    video.poster = project.poster;
    video.muted = true; // the attribute alone is not enough for autoplay on a cloned element
    video.setAttribute("aria-label", `Video of ${project.title}`);
    if (reduceMotion) video.controls = true;
  } else {
    video.remove();
  }

  project.products.forEach((src, index) => {
    const image = document.createElement("img");
    image.src = src;
    image.alt = `${project.title}, product shot ${index + 1}`;
    image.loading = "lazy";
    image.draggable = false;
    shots.append(image);
  });
  if (!project.products.length) shots.remove();

  if (project.prototype) {
    prototype.src = project.prototype;
    prototype.setAttribute("aria-label", `Prototype of ${project.title}`);
  } else {
    prototype.remove();
    article.querySelector(".prototype-label").remove();
  }

  return article;
}

// A project replaces the line of its moment. The rest of the list fills the day.
function renderDay(moments, projects) {
  const chosen = new Set(projects.map((project) => sameText(project.moment)));
  const entries = [
    ...moments.filter((moment) => !chosen.has(sameText(moment.text))).map((moment) => ({ time: moment.time, node: renderMoment(moment) })),
    ...projects.map((project) => ({ time: project.time, node: renderProject(project) })),
  ];
  entries.sort((a, b) => toMinute(a.time) - toMinute(b.time));
  day.append(...entries.map((entry) => entry.node));
}

function blendChannel(from, to, amount, start) {
  const a = parseInt(from.slice(start, start + 2), 16);
  const b = parseInt(to.slice(start, start + 2), 16);
  return Math.round(a + (b - a) * amount);
}

function blend(from, to, amount) {
  return [1, 3, 5].map((start) => blendChannel(from, to, amount, start));
}

function luminance([r, g, b]) {
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function paintSky(minute) {
  const next = SKY.findIndex((stop) => stop.minute >= minute);
  const to = SKY[Math.max(next, 1)];
  const from = SKY[Math.max(next, 1) - 1];
  const amount = (minute - from.minute) / (to.minute - from.minute);
  const top = blend(from.top, to.top, amount);
  const bottom = blend(from.bottom, to.bottom, amount);
  const root = document.documentElement.style;
  root.setProperty("--sky-top", `rgb(${top})`);
  root.setProperty("--sky-bottom", `rgb(${bottom})`);
  // Dark text on a bright sky, light text on a dark one.
  const bright = luminance(top) + luminance(bottom) > 0.42;
  document.documentElement.dataset.ink = bright ? "dark" : "light";
}

// The time depends on what crosses the middle of the screen, not on the page
// percentage. An open project therefore keeps its hour until you scroll past it.
function currentMinute() {
  const middle = innerHeight / 2;
  let previous = null;
  for (const element of document.querySelectorAll("[data-minute]")) {
    const box = element.getBoundingClientRect();
    const minute = Number(element.dataset.minute);
    const reach = Math.min(box.height, innerHeight) / 2;
    const start = box.top + reach;
    const end = box.bottom - reach;
    if (middle < start) {
      if (!previous) return minute;
      const amount = (middle - previous.end) / (start - previous.end);
      return previous.minute + (minute - previous.minute) * amount;
    }
    if (middle <= end) return minute;
    previous = { end, minute };
  }
  return previous ? previous.minute : 0;
}

function update() {
  const minute = currentMinute();
  paintSky(Math.min(minute, 1440));
  const shown = Math.round(minute) % 1440;
  clock.textContent = `${String(Math.floor(shown / 60)).padStart(2, "0")}:${String(shown % 60).padStart(2, "0")}`;
}

let waiting = false;
function scheduleUpdate() {
  if (waiting) return;
  waiting = true;
  requestAnimationFrame(() => {
    waiting = false;
    update();
    syncVideos();
  });
}

// Of the videos with at least half on screen, only the one closest to the middle plays.
function syncVideos() {
  if (reduceMotion) return;
  let closest = null;
  let shortest = Infinity;
  const videos = document.querySelectorAll(".film");
  videos.forEach((video) => {
    const box = video.getBoundingClientRect();
    const visible = Math.min(box.bottom, innerHeight) - Math.max(box.top, 0);
    const distance = Math.abs((box.top + box.bottom) / 2 - innerHeight / 2);
    if (visible >= box.height / 2 && distance < shortest) {
      closest = video;
      shortest = distance;
    }
  });
  videos.forEach((video) => {
    if (video !== closest) video.pause();
    else if (video.paused && !video.controls) playVideo(video);
  });
}

// Some devices refuse autoplay, for example Safari in Low Power Mode.
// The controls then let the person press play.
function playVideo(video) {
  video.play().catch((error) => {
    if (error.name === "NotAllowedError") video.controls = true;
  });
}

function setUpToggles() {
  day.addEventListener("click", (event) => {
    const button = event.target.closest(".toggle");
    if (!button) return;
    const open = button.closest(".project").classList.toggle("open");
    button.setAttribute("aria-expanded", open);
  });
}

// Touch and trackpad scroll the product shots natively. A mouse has no sideways
// gesture and the scrollbar is hidden, so it drags them instead.
function setUpDragging() {
  day.addEventListener("pointerdown", (event) => {
    const shots = event.target.closest(".shots");
    if (!shots || event.pointerType !== "mouse") return;
    const startX = event.clientX;
    const startScroll = shots.scrollLeft;
    const move = (moveEvent) => {
      shots.classList.add("dragging");
      shots.scrollLeft = startScroll - (moveEvent.clientX - startX);
    };
    const stop = () => {
      shots.classList.remove("dragging");
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", stop);
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", stop);
  });
}

// Left and right arrows jump between projects during the final presentation.
function jumpBetweenProjects(event) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  if (event.target.closest?.(".shots, video")) return;
  const projects = [...document.querySelectorAll(".project")];
  const target = event.key === "ArrowRight"
    ? projects.find((project) => project.getBoundingClientRect().top > 1)
    : projects.findLast((project) => project.getBoundingClientRect().top < -1);
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}

renderDay(window.MOMENTS, window.PROJECTS);
setUpToggles();
setUpDragging();
update();
syncVideos();
addEventListener("scroll", scheduleUpdate, { passive: true });
addEventListener("resize", scheduleUpdate);
addEventListener("keydown", jumpBetweenProjects);
day.addEventListener("transitionend", scheduleUpdate);

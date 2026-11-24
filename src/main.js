import './style.css';

const screen = document.querySelector('.exhibition');
const stages = [...document.querySelectorAll('.stage')];
const announcement = document.querySelector('#stage-announcement');

requestAnimationFrame(() => requestAnimationFrame(() => screen.classList.add('is-ready')));

for (const stage of stages) {
  stage.addEventListener('click', () => {
    if (stage.getAttribute('aria-pressed') === 'true') return;
    for (const card of stages) card.setAttribute('aria-pressed', String(card === stage));
    const name = stage.querySelector('.stage-name').textContent;
    announcement.textContent = `${name} selected. ${stage.querySelector('.plan').innerText.replace(/\n/g, '. ')}.`;
  });
}

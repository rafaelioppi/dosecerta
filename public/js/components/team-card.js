/**
 * <team-card name="..." role="..." bio="..." initials="CA"></team-card>
 * Card de membro de equipe com avatar gerado por iniciais (sem fotos de banco de imagem).
 */
const AVATAR_PALETTE = [
  ["#12405a", "#1c6a94"],
  ["#21867a", "#4db6a8"],
  ["#175577", "#2a9d8f"],
  ["#0b2d3f", "#21867a"],
];

function paletteForString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  const [from, to] = AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}

class TeamCard extends HTMLElement {
  connectedCallback() {
    const name = this.getAttribute("name") || "";
    const role = this.getAttribute("role") || "";
    const bio = this.getAttribute("bio") || "";
    const initials = this.getAttribute("initials") || name.slice(0, 2).toUpperCase();

    this.innerHTML = `
      <article class="card team-card" data-reveal>
        <div class="team-card__avatar" style="background:${paletteForString(name)}" aria-hidden="true">${initials}</div>
        <h3>${name}</h3>
        <p class="role">${role}</p>
        <p class="bio">${bio}</p>
      </article>
    `;
  }
}

customElements.define("team-card", TeamCard);

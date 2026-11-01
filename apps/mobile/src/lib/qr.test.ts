import { describe, expect, it } from "vitest";
import { qrMatrix } from "./qr";

const rows = (matrix: boolean[][]) => matrix.map((row) => row.map((dark) => (dark ? "#" : ".")).join(""));

describe("QR code", () => {
  it("dessine les repères et la bonne taille", () => {
    const matrix = qrMatrix("https://tartan.coach/i/abc");
    expect(matrix.length % 4).toBe(1);
    const lines = rows(matrix);
    expect(lines[0]!.slice(0, 7)).toBe("#######");
    expect(lines[1]!.slice(0, 7)).toBe("#.....#");
    expect(lines[2]!.slice(0, 7)).toBe("#.###.#");
    expect(lines[0]!.slice(-7)).toBe("#######");
    expect(lines.at(-1)!.slice(0, 7)).toBe("#######");
  });

  it("produit la même matrice que la bibliothèque `qrcode` du site", () => {
    expect(rows(qrMatrix("https://tartan.coach/i/abc"))).toEqual([
      "#######.#...###...#######",
      "#.....#.#######.#.#.....#",
      "#.###.#.#..#.##...#.###.#",
      "#.###.#....#.#.##.#.###.#",
      "#.###.#.#.###.#.#.#.###.#",
      "#.....#...#.##....#.....#",
      "#######.#.#.#.#.#.#######",
      ".........#...#.#.........",
      "#..#######.#..####..#.###",
      ".##.#...####.###...#####.",
      ".##.###...#.#.##.##.##..#",
      ".#..#...#...#..#..##.####",
      "...#..####..#.#.#.#.....#",
      "###.#..#..#.#.##.#..#..#.",
      "###.#.#.......###.#.#####",
      "#..#....#####..#...#.##.#",
      "#.#.#.#.#.####..#####.##.",
      "........#....#..#...#.##.",
      "#######.#.#####.#.#.#...#",
      "#.....#.######.##...#....",
      "#.###.#.#.#.#..######....",
      "#.###.#.##.#.######....##",
      "#.###.#..#.#.#.#....#####",
      "#.....#..####.#...###.###",
      "#######.#..##...###..#..#",
    ]);
  });

  it("grandit avec la longueur du lien", () => {
    expect(qrMatrix("a").length).toBe(21);
    expect(qrMatrix("a".repeat(60)).length).toBeGreaterThan(21);
    expect(qrMatrix("a".repeat(1000)).length).toBeGreaterThan(100);
  });
});

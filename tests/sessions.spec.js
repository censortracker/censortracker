import sessions from "../src/chrome/js/core/sessions"


describe("Default max redirections count", () => {
  test("it should be equal to 6", () => {
    expect(sessions.max_redirections_count).toEqual(6);
  });
});

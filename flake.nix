{
  description = "Censor Tracker development shell";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    # Oldest nixpkgs builds that satisfy src/manifest.ts minimum versions.
    nixpkgs-chromium-min.url = "github:NixOS/nixpkgs/0c9aadc8eff6daaa5149d2df9e6c49baaf44161c"; # chromium 108.0.5359.124
    nixpkgs-firefox-min.url = "github:NixOS/nixpkgs/9a17f325397d137ac4d219ecbd5c7f15154422f4"; # firefox-esr 91.10.0esr
  };

  outputs = { nixpkgs, nixpkgs-chromium-min, nixpkgs-firefox-min, ... }:
    let
      forAllSystems = nixpkgs.lib.genAttrs [ "x86_64-linux" "aarch64-linux" ];
    in
    {
      devShells = forAllSystems (system:
        let
          # Prebuilt Firefox is unfree but needs no local build.
          pkgs = import nixpkgs {
            inherit system;
            config.allowUnfreePredicate = pkg: nixpkgs.lib.hasPrefix "firefox-bin" (nixpkgs.lib.getName pkg);
          };
          alias = name: bin: pkgs.writeShellScriptBin name ''exec ${bin} "$@"'';
          chromium-latest = alias "chromium-latest" "${pkgs.chromium}/bin/chromium";
          firefox-latest = alias "firefox-latest" "${pkgs.firefox-bin}/bin/firefox";
          chromium-min = alias "chromium-min" "${nixpkgs-chromium-min.legacyPackages.${system}.chromium}/bin/chromium";
          firefox-min = alias "firefox-min" "${nixpkgs-firefox-min.legacyPackages.${system}.firefox-esr}/bin/firefox";
        in
        {
          default = pkgs.mkShell {
            packages = [ pkgs.nodejs_24 pkgs.gnumake chromium-latest firefox-latest chromium-min firefox-min ];
            # Browser tests read these variables.
            CHROMIUM = "${chromium-latest}/bin/chromium-latest";
            FIREFOX = "${firefox-latest}/bin/firefox-latest";
          };
        });
    };
}

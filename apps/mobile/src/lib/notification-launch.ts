// Un toucher peut lancer l'app avant que la navigation existe : la route attend, puis l'aiguillage la consomme.
export const createLaunchRoute = () => {
  let held: string | null = null;
  let ready = false;
  return {
    offer: (route: string, navigate: (route: string) => void): void => {
      if (ready) navigate(route);
      else held = route;
    },
    take: (): string | null => {
      ready = true;
      const route = held;
      held = null;
      return route;
    },
  };
};

export const launchRoute = createLaunchRoute();
